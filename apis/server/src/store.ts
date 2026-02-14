import { and, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import {
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  ApiKeySummary,
  CreateApiKeyResponse,
  FeatureHighlight,
  LoginResponse,
  ReferenceVideo,
  RegisterRequest,
  ResetPasswordRequest,
  StripeCheckoutResponse,
  UserProfile,
  VideoTask,
  VideoTaskCreateRequest,
  VideoTaskCreateResponse,
} from "@viralvector/common/contracts";
import { env } from "./env";
import { initializeDatabase } from "@viralvector/db/bootstrap";
import { database } from "@viralvector/db/client";
import {
  apiKeysTable,
  creditLedgerTable,
  passkeysTable,
  passwordResetTokensTable,
  paymentsTable,
  usersTable,
  videoTasksTable,
} from "@viralvector/db/schema";

interface SessionRecord {
  sessionId: string;
  userId: string;
  createdAtUnixMs: number;
}

interface GoogleOauthStateRecord {
  state: string;
  nextPath: string;
  createdAtUnixMs: number;
}

const sessionStore = new Map<string, SessionRecord>();
const pendingPasskeyLoginStore = new Map<string, { userId: string; challenge: string; createdAtUnixMs: number }>();
const pendingPasskeyRegistrationStore = new Map<string, { userId: string; challenge: string; createdAtUnixMs: number }>();
const googleOauthStateStore = new Map<string, GoogleOauthStateRecord>();
const stripeClient = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

const SESSION_TTL_MS = env.sessionTtlSeconds * 1000;
const PENDING_PASSKEY_CHALLENGE_TTL_MS = 1000 * 60 * 5;
const GOOGLE_OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const API_KEY_MASK_SECTION = "************";
const MINIMUM_VIDEO_DURATION_SECONDS = 4;
const MAXIMUM_VIDEO_DURATION_SECONDS = 12;

const getIsoTimestamp = (): string => {
  return new Date().toISOString();
};

const hashToken = (rawToken: string): string => {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
};

const clampDurationSeconds = (durationSeconds: number): number => {
  if (durationSeconds < MINIMUM_VIDEO_DURATION_SECONDS) {
    return MINIMUM_VIDEO_DURATION_SECONDS;
  }
  if (durationSeconds > MAXIMUM_VIDEO_DURATION_SECONDS) {
    return MAXIMUM_VIDEO_DURATION_SECONDS;
  }
  return Math.round(durationSeconds);
};

const calculateVideoTaskCredits = (durationSeconds: number): number => {
  const normalizedDurationSeconds = clampDurationSeconds(durationSeconds);
  return env.creditsPerTask + normalizedDurationSeconds;
};

const toBase64Url = (buffer: ArrayBuffer | Uint8Array | string): string => {
  if (typeof buffer === "string") {
    return buffer;
  }
  const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Buffer.from(source).toString("base64url");
};

const fromBase64Url = (value: string): Uint8Array => {
  return new Uint8Array(Buffer.from(value, "base64url"));
};

const mapDatabaseUserToProfile = (databaseUser: typeof usersTable.$inferSelect): UserProfile => {
  return {
    id: databaseUser.id,
    name: databaseUser.name,
    email: databaseUser.email,
    apiCredits: databaseUser.apiCredits,
  };
};

const mapDatabaseTaskToContract = (databaseTask: typeof videoTasksTable.$inferSelect): VideoTask => {
  return {
    id: databaseTask.id,
    userId: databaseTask.userId,
    model: databaseTask.model,
    prompt: databaseTask.prompt,
    imageUrl: databaseTask.imageUrl,
    aspectRatio: databaseTask.aspectRatio as VideoTask["aspectRatio"],
    durationSeconds: databaseTask.durationSeconds,
    creditsCost: databaseTask.creditsCost,
    status: databaseTask.status as VideoTask["status"],
    providerTaskId: databaseTask.providerTaskId,
    outputVideoUrl: databaseTask.outputVideoUrl,
    errorMessage: databaseTask.errorMessage,
    createdAt: databaseTask.createdAt,
    updatedAt: databaseTask.updatedAt,
    completedAt: databaseTask.completedAt,
  };
};

const mapDatabaseApiKeyToSummary = (databaseApiKey: typeof apiKeysTable.$inferSelect): ApiKeySummary => {
  return {
    id: databaseApiKey.id,
    name: databaseApiKey.name,
    prefix: databaseApiKey.prefix,
    maskedKey: databaseApiKey.maskedKey,
    createdAt: databaseApiKey.createdAt,
    lastUsedAt: databaseApiKey.lastUsedAt,
    status: databaseApiKey.status,
  };
};

const pruneExpiredSessions = () => {
  const nowUnixMs = Date.now();
  for (const [sessionId, sessionRecord] of sessionStore.entries()) {
    const sessionAgeMs = nowUnixMs - sessionRecord.createdAtUnixMs;
    if (sessionAgeMs > SESSION_TTL_MS) {
      sessionStore.delete(sessionId);
    }
  }
};

const pruneExpiredPasskeyChallenges = () => {
  const nowUnixMs = Date.now();

  for (const [token, challengeRecord] of pendingPasskeyLoginStore.entries()) {
    if (nowUnixMs - challengeRecord.createdAtUnixMs > PENDING_PASSKEY_CHALLENGE_TTL_MS) {
      pendingPasskeyLoginStore.delete(token);
    }
  }

  for (const [token, challengeRecord] of pendingPasskeyRegistrationStore.entries()) {
    if (nowUnixMs - challengeRecord.createdAtUnixMs > PENDING_PASSKEY_CHALLENGE_TTL_MS) {
      pendingPasskeyRegistrationStore.delete(token);
    }
  }
};

const pruneExpiredGoogleOauthStates = () => {
  const nowUnixMs = Date.now();
  for (const [state, stateRecord] of googleOauthStateStore.entries()) {
    if (nowUnixMs - stateRecord.createdAtUnixMs > GOOGLE_OAUTH_STATE_TTL_MS) {
      googleOauthStateStore.delete(state);
    }
  }
};

const generateRawApiKey = (): string => {
  return `ave_live_${crypto.randomUUID().replaceAll("-", "")}`;
};

const generateApiKeyMask = (rawApiKey: string): string => {
  const prefixLength = 12;
  const suffixLength = 4;
  const prefix = rawApiKey.slice(0, prefixLength);
  const suffix = rawApiKey.slice(-suffixLength);
  return `${prefix}${API_KEY_MASK_SECTION}${suffix}`;
};

const getTaskDemoVideoUrl = (taskId: string): string => {
  const referenceVideoIndex = Math.abs(taskId.length + taskId.charCodeAt(0)) % referenceVideos.length;
  return referenceVideos[referenceVideoIndex]?.videoUrl ?? referenceVideos[0]!.videoUrl;
};

const enqueueTaskProgression = (taskId: string) => {
  setTimeout(async () => {
    const processingTimestamp = getIsoTimestamp();
    await database
      .update(videoTasksTable)
      .set({
        status: "processing",
        updatedAt: processingTimestamp,
      })
      .where(eq(videoTasksTable.id, taskId));
  }, 1000);

  setTimeout(async () => {
    const completionTimestamp = getIsoTimestamp();
    await database
      .update(videoTasksTable)
      .set({
        status: "succeeded",
        providerTaskId: `seedance_${taskId}`,
        outputVideoUrl: getTaskDemoVideoUrl(taskId),
        updatedAt: completionTimestamp,
        completedAt: completionTimestamp,
      })
      .where(eq(videoTasksTable.id, taskId));
  }, 3500);
};

const grantCredits = async (input: {
  userId: string;
  deltaCredits: number;
  reason: string;
  referenceId?: string;
  metadataJson?: string;
}) => {
  const now = getIsoTimestamp();
  const [updatedUser] = await database
    .update(usersTable)
    .set({
      apiCredits: sql`${usersTable.apiCredits} + ${input.deltaCredits}`,
      updatedAt: now,
    })
    .where(eq(usersTable.id, input.userId))
    .returning();

  if (!updatedUser) {
    throw new Error("User not found while adjusting credits.");
  }

  await database.insert(creditLedgerTable).values({
    id: `cred_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
    userId: input.userId,
    deltaCredits: input.deltaCredits,
    balanceAfter: updatedUser.apiCredits,
    reason: input.reason,
    referenceId: input.referenceId ?? null,
    metadataJson: input.metadataJson ?? null,
    createdAt: now,
  });

  return updatedUser.apiCredits;
};

export const initializeApplicationData = async (): Promise<void> => {
  await initializeDatabase();
};

const createSessionForUser = (userId: string): string => {
  const sessionId = crypto.randomUUID();
  sessionStore.set(sessionId, {
    sessionId,
    userId,
    createdAtUnixMs: Date.now(),
  });
  return sessionId;
};

const getUserByEmail = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const [databaseUser] = await database.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
  return databaseUser ?? null;
};

const createUserFromGoogleProfile = async (input: { email: string; name: string }): Promise<typeof usersTable.$inferSelect> => {
  const now = getIsoTimestamp();
  const [databaseUser] = await database
    .insert(usersTable)
    .values({
      id: `usr_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      name: input.name,
      email: input.email,
      passwordHash: await Bun.password.hash(crypto.randomUUID()),
      apiCredits: env.initialUserCredits,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return databaseUser!;
};

export const authStore = {
  async register(input: RegisterRequest): Promise<UserProfile> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = getIsoTimestamp();
    const [existingUser] = await database.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
    if (existingUser) {
      throw new Error("Email already registered.");
    }

    const [createdUser] = await database
      .insert(usersTable)
      .values({
        id: `usr_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash: await Bun.password.hash(input.password),
        apiCredits: env.initialUserCredits,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return mapDatabaseUserToProfile(createdUser!);
  },

  createGoogleStartUrl(nextPath: string): string {
    if (!env.googleClientId || !env.googleClientSecret) {
      throw new Error("Google OAuth credentials are not configured.");
    }

    pruneExpiredGoogleOauthStates();
    const normalizedNextPath = nextPath.startsWith("/") ? nextPath : "/dashboard";
    const state = crypto.randomUUID();
    googleOauthStateStore.set(state, {
      state,
      nextPath: normalizedNextPath,
      createdAtUnixMs: Date.now(),
    });

    const searchParams = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: env.googleRedirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${searchParams.toString()}`;
  },

  async loginWithGoogleCode(
    code: string,
    state: string,
  ): Promise<{ sessionId: string; user: UserProfile; nextPath: string } | null> {
    if (!env.googleClientId || !env.googleClientSecret) {
      throw new Error("Google OAuth credentials are not configured.");
    }

    pruneExpiredGoogleOauthStates();
    const stateRecord = googleOauthStateStore.get(state);
    if (!stateRecord) {
      return null;
    }
    googleOauthStateStore.delete(state);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: env.googleRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return null;
    }
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return null;
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    if (!profileResponse.ok) {
      return null;
    }
    const profileData = (await profileResponse.json()) as { email?: string; name?: string };
    const email = profileData.email?.trim().toLowerCase();
    if (!email) {
      return null;
    }

    const name = profileData.name?.trim() || email.split("@")[0] || "Google User";
    const existingUser = await getUserByEmail(email);
    const databaseUser = existingUser ?? (await createUserFromGoogleProfile({ email, name }));
    const sessionId = createSessionForUser(databaseUser.id);

    return {
      sessionId,
      user: mapDatabaseUserToProfile(databaseUser),
      nextPath: stateRecord.nextPath,
    };
  },

  async login(email: string, password: string): Promise<{ sessionId: string | null; response: LoginResponse } | null> {
    const databaseUser = await getUserByEmail(email);
    if (!databaseUser) {
      return null;
    }

    const isPasswordMatch = await Bun.password.verify(password, databaseUser.passwordHash);
    if (!isPasswordMatch) {
      return null;
    }

    const userPasskeys = await database
      .select()
      .from(passkeysTable)
      .where(eq(passkeysTable.userId, databaseUser.id))
      .orderBy(desc(passkeysTable.createdAt));

    if (userPasskeys.length > 0) {
      const passkeyOptions = await generateAuthenticationOptions({
        rpID: env.passkeyRpId,
        allowCredentials: userPasskeys.map(passkey => ({
          id: passkey.credentialId,
          transports: passkey.transportsJson ? (JSON.parse(passkey.transportsJson) as AuthenticatorTransport[]) : [],
        })),
        userVerification: "preferred",
      });

      const pendingLoginToken = crypto.randomUUID();
      pendingPasskeyLoginStore.set(pendingLoginToken, {
        userId: databaseUser.id,
        challenge: passkeyOptions.challenge,
        createdAtUnixMs: Date.now(),
      });

      return {
        sessionId: null,
        response: {
          requiresPasskey: true,
          pendingLoginToken,
          passkeyOptions: passkeyOptions as unknown as Record<string, unknown>,
        },
      };
    }

    const sessionId = createSessionForUser(databaseUser.id);

    return {
      sessionId,
      response: {
        user: mapDatabaseUserToProfile(databaseUser),
      },
    };
  },

  async getUserBySession(sessionId: string | null): Promise<UserProfile | null> {
    if (!sessionId) {
      return null;
    }
    pruneExpiredSessions();
    const sessionRecord = sessionStore.get(sessionId);
    if (!sessionRecord) {
      return null;
    }

    const [databaseUser] = await database.select().from(usersTable).where(eq(usersTable.id, sessionRecord.userId)).limit(1);
    if (!databaseUser) {
      return null;
    }
    return mapDatabaseUserToProfile(databaseUser);
  },

  async createForgotPasswordToken(email: string): Promise<string | null> {
    const databaseUser = await getUserByEmail(email);
    if (!databaseUser) {
      return null;
    }

    const rawToken = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const now = getIsoTimestamp();
    const expiresAt = new Date(Date.now() + env.passwordResetTokenTtlMinutes * 60 * 1000).toISOString();

    await database.insert(passwordResetTokensTable).values({
      id: `prt_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      userId: databaseUser.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
      usedAt: null,
      createdAt: now,
    });

    return rawToken;
  },

  async resetPassword(input: ResetPasswordRequest): Promise<boolean> {
    const tokenHash = hashToken(input.token);
    const now = getIsoTimestamp();
    const [databaseToken] = await database
      .select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.tokenHash, tokenHash))
      .limit(1);

    if (!databaseToken || databaseToken.usedAt || databaseToken.expiresAt < now) {
      return false;
    }

    await database.transaction(async tx => {
      await tx
        .update(usersTable)
        .set({
          passwordHash: await Bun.password.hash(input.password),
          updatedAt: now,
        })
        .where(eq(usersTable.id, databaseToken.userId));

      await tx
        .update(passwordResetTokensTable)
        .set({
          usedAt: now,
        })
        .where(eq(passwordResetTokensTable.id, databaseToken.id));
    });

    return true;
  },

  async verifyPasskeySecondFactor(
    pendingLoginToken: string,
    response: AuthenticationResponseJSON,
  ): Promise<{ sessionId: string; user: UserProfile } | null> {
    pruneExpiredPasskeyChallenges();
    const challengeRecord = pendingPasskeyLoginStore.get(pendingLoginToken);
    if (!challengeRecord) {
      return null;
    }

    const [databasePasskey] = await database
      .select()
      .from(passkeysTable)
      .where(and(eq(passkeysTable.userId, challengeRecord.userId), eq(passkeysTable.credentialId, response.id)))
      .limit(1);
    if (!databasePasskey) {
      return null;
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: env.passkeyOrigin,
      expectedRPID: env.passkeyRpId,
      credential: {
        id: databasePasskey.credentialId,
        publicKey: fromBase64Url(databasePasskey.credentialPublicKey) as Uint8Array<ArrayBuffer>,
        counter: databasePasskey.counter,
        transports: databasePasskey.transportsJson
          ? (JSON.parse(databasePasskey.transportsJson) as AuthenticatorTransport[])
          : [],
      },
    });

    if (!verification.verified) {
      return null;
    }

    const now = getIsoTimestamp();
    await database
      .update(passkeysTable)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: now,
      })
      .where(eq(passkeysTable.id, databasePasskey.id));

    pendingPasskeyLoginStore.delete(pendingLoginToken);

    const [databaseUser] = await database.select().from(usersTable).where(eq(usersTable.id, challengeRecord.userId)).limit(1);
    if (!databaseUser) {
      return null;
    }

    const sessionId = createSessionForUser(databaseUser.id);
    return {
      sessionId,
      user: mapDatabaseUserToProfile(databaseUser),
    };
  },

  async createPasskeyRegistrationOptions(userId: string): Promise<{
    token: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }> {
    pruneExpiredPasskeyChallenges();
    const existingPasskeys = await database.select().from(passkeysTable).where(eq(passkeysTable.userId, userId));

    const options = await generateRegistrationOptions({
      rpID: env.passkeyRpId,
      rpName: env.passkeyRpName,
      userName: userId,
      userDisplayName: `user-${userId.slice(0, 8)}`,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: existingPasskeys.map(passkey => ({
        id: passkey.credentialId,
        transports: passkey.transportsJson
          ? (JSON.parse(passkey.transportsJson) as AuthenticatorTransport[])
          : [],
      })),
    });

    const token = crypto.randomUUID();
    pendingPasskeyRegistrationStore.set(token, {
      userId,
      challenge: options.challenge,
      createdAtUnixMs: Date.now(),
    });

    return { token, options };
  },

  async verifyPasskeyRegistration(
    token: string,
    registrationResponse: RegistrationResponseJSON,
  ): Promise<boolean> {
    pruneExpiredPasskeyChallenges();
    const pendingRecord = pendingPasskeyRegistrationStore.get(token);
    if (!pendingRecord) {
      return false;
    }

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: pendingRecord.challenge,
      expectedOrigin: env.passkeyOrigin,
      expectedRPID: env.passkeyRpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return false;
    }

    const now = getIsoTimestamp();
    await database.insert(passkeysTable).values({
      id: `psk_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      userId: pendingRecord.userId,
      credentialId: toBase64Url(verification.registrationInfo.credential.id),
      credentialPublicKey: toBase64Url(verification.registrationInfo.credential.publicKey),
      counter: verification.registrationInfo.credential.counter,
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp ? 1 : 0,
      transportsJson: registrationResponse.response.transports
        ? JSON.stringify(registrationResponse.response.transports)
        : null,
      createdAt: now,
      lastUsedAt: null,
    });

    pendingPasskeyRegistrationStore.delete(token);
    return true;
  },

  logout(sessionId: string | null): void {
    if (sessionId) {
      sessionStore.delete(sessionId);
    }
  },

  sessionMaxAgeSeconds: env.sessionTtlSeconds,
};

export const apiKeyService = {
  async list(userId: string): Promise<ApiKeySummary[]> {
    const databaseApiKeys = await database
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.userId, userId))
      .orderBy(desc(apiKeysTable.createdAt));
    return databaseApiKeys.map(mapDatabaseApiKeyToSummary);
  },

  async create(userId: string, name: string): Promise<CreateApiKeyResponse> {
    const now = getIsoTimestamp();
    const rawApiKey = generateRawApiKey();
    const keyHash = await Bun.password.hash(rawApiKey);
    const apiKeyId = `key_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const prefix = rawApiKey.slice(0, 12);
    const maskedKey = generateApiKeyMask(rawApiKey);

    const [databaseApiKey] = await database
      .insert(apiKeysTable)
      .values({
        id: apiKeyId,
        userId,
        name,
        keyHash,
        prefix,
        maskedKey,
        status: "active",
        lastUsedAt: null,
        createdAt: now,
      })
      .returning();

    return {
      apiKey: mapDatabaseApiKeyToSummary(databaseApiKey!),
      rawKey: rawApiKey,
    };
  },

  async revoke(userId: string, keyId: string): Promise<boolean> {
    const [updatedApiKey] = await database
      .update(apiKeysTable)
      .set({ status: "revoked" })
      .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.id, keyId)))
      .returning();

    return Boolean(updatedApiKey);
  },

  async rotate(userId: string, keyId: string, name?: string): Promise<CreateApiKeyResponse | null> {
    const existingApiKeys = await database
      .select()
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.id, keyId)))
      .limit(1);

    const existingApiKey = existingApiKeys[0];
    if (!existingApiKey || existingApiKey.status !== "active") {
      return null;
    }

    const nextName = name?.trim() || `${existingApiKey.name} (rotated)`;
    const rotatedApiKey = await this.create(userId, nextName);
    await this.revoke(userId, keyId);
    return rotatedApiKey;
  },
};

export const videoTaskService = {
  async listByUser(userId: string): Promise<VideoTask[]> {
    const databaseTasks = await database
      .select()
      .from(videoTasksTable)
      .where(eq(videoTasksTable.userId, userId))
      .orderBy(desc(videoTasksTable.createdAt));
    return databaseTasks.map(mapDatabaseTaskToContract);
  },

  async getById(userId: string, taskId: string): Promise<VideoTask | null> {
    const [databaseTask] = await database
      .select()
      .from(videoTasksTable)
      .where(and(eq(videoTasksTable.userId, userId), eq(videoTasksTable.id, taskId)))
      .limit(1);

    if (!databaseTask) {
      return null;
    }
    return mapDatabaseTaskToContract(databaseTask);
  },

  async create(userId: string, requestBody: VideoTaskCreateRequest): Promise<VideoTaskCreateResponse> {
    const now = getIsoTimestamp();
    const normalizedDuration = clampDurationSeconds(requestBody.durationSeconds);
    const creditsCost = calculateVideoTaskCredits(normalizedDuration);
    const taskId = `task_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;

    let remainingCredits = 0;

    await database.transaction(async tx => {
      const [databaseUser] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!databaseUser) {
        throw new Error("User not found for task creation.");
      }
      if (databaseUser.apiCredits < creditsCost) {
        throw new Error("Insufficient API credits.");
      }

      const nextCreditsBalance = databaseUser.apiCredits - creditsCost;
      remainingCredits = nextCreditsBalance;

      await tx
        .update(usersTable)
        .set({
          apiCredits: nextCreditsBalance,
          updatedAt: now,
        })
        .where(eq(usersTable.id, userId));

      await tx.insert(videoTasksTable).values({
        id: taskId,
        userId,
        model: env.seedanceModel,
        prompt: requestBody.prompt,
        imageUrl: requestBody.imageUrl ?? null,
        aspectRatio: requestBody.aspectRatio,
        durationSeconds: normalizedDuration,
        creditsCost,
        status: "queued",
        providerTaskId: null,
        outputVideoUrl: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      await tx.insert(creditLedgerTable).values({
        id: `cred_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
        userId,
        deltaCredits: -creditsCost,
        balanceAfter: nextCreditsBalance,
        reason: "video_task_created",
        referenceId: taskId,
        metadataJson: JSON.stringify({
          model: env.seedanceModel,
          durationSeconds: normalizedDuration,
        }),
        createdAt: now,
      });
    });

    enqueueTaskProgression(taskId);

    const createdTask = await this.getById(userId, taskId);
    if (!createdTask) {
      throw new Error("Task creation failed.");
    }

    return {
      task: createdTask,
      remainingCredits,
    };
  },
};

export const paymentService = {
  async createStripeCheckoutSession(userId: string, creditsToBuy: number): Promise<StripeCheckoutResponse> {
    if (!stripeClient) {
      throw new Error("Stripe is not configured.");
    }
    if (!env.stripePriceId) {
      throw new Error("STRIPE_PRICE_ID is not configured.");
    }

    const checkoutSession = await stripeClient.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: env.stripePriceId, quantity: 1 }],
      success_url: env.stripeSuccessUrl,
      cancel_url: env.stripeCancelUrl,
      metadata: {
        userId,
        creditsToBuy: String(creditsToBuy),
      },
    });

    return {
      checkoutUrl: checkoutSession.url ?? "",
      sessionId: checkoutSession.id,
    };
  },

  async createApplePayIntent(userId: string, creditsToBuy: number): Promise<{ clientSecret: string; paymentIntentId: string }> {
    if (!stripeClient) {
      throw new Error("Stripe is not configured.");
    }
    if (!Number.isFinite(creditsToBuy) || creditsToBuy <= 0) {
      throw new Error("creditsToBuy must be greater than zero.");
    }

    const amountMinor = Math.max(50, Math.round(creditsToBuy * 100));
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: amountMinor,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId,
        creditsToBuy: String(Math.round(creditsToBuy)),
        paymentMethodHint: "apple_pay",
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error("Stripe did not return a client secret.");
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  },

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const creditsToBuy = Number(session.metadata?.creditsToBuy ?? "0");
      if (!userId || !Number.isFinite(creditsToBuy) || creditsToBuy <= 0) {
        return;
      }

      const providerPaymentId = `stripe_${session.id}`;
      const now = getIsoTimestamp();
      const [existingPayment] = await database
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.providerPaymentId, providerPaymentId))
        .limit(1);
      if (existingPayment) {
        return;
      }

      await database.insert(paymentsTable).values({
        id: `pay_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
        userId,
        provider: "stripe",
        providerPaymentId,
        status: "succeeded",
        amountMinor: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        creditsPurchased: creditsToBuy,
        rawPayloadJson: JSON.stringify(session),
        createdAt: now,
        updatedAt: now,
      });

      await grantCredits({
        userId,
        deltaCredits: creditsToBuy,
        reason: "payment_stripe_succeeded",
        referenceId: providerPaymentId,
        metadataJson: JSON.stringify({ sessionId: session.id }),
      });
      return;
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata.userId;
      const creditsToBuy = Number(paymentIntent.metadata.creditsToBuy ?? "0");
      if (!userId || !Number.isFinite(creditsToBuy) || creditsToBuy <= 0) {
        return;
      }

      const providerPaymentId = `stripe_pi_${paymentIntent.id}`;
      const now = getIsoTimestamp();
      const [existingPayment] = await database
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.providerPaymentId, providerPaymentId))
        .limit(1);
      if (existingPayment) {
        return;
      }

      await database.insert(paymentsTable).values({
        id: `pay_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
        userId,
        provider: "stripe",
        providerPaymentId,
        status: "succeeded",
        amountMinor: paymentIntent.amount_received || paymentIntent.amount,
        currency: paymentIntent.currency,
        creditsPurchased: creditsToBuy,
        rawPayloadJson: JSON.stringify(paymentIntent),
        createdAt: now,
        updatedAt: now,
      });

      await grantCredits({
        userId,
        deltaCredits: creditsToBuy,
        reason: "payment_stripe_applepay_succeeded",
        referenceId: providerPaymentId,
        metadataJson: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      });
    }
  },

  async handleUsdtPayment(payload: {
    transactionId: string;
    userId: string;
    amountMinor: number;
    currency: string;
    network: string;
    status: "pending" | "confirmed" | "failed";
    confirmations: number;
  }): Promise<void> {
    const providerPaymentId = `usdt_${payload.transactionId}`;
    const now = getIsoTimestamp();

    const [existingPayment] = await database
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.providerPaymentId, providerPaymentId))
      .limit(1);

    const derivedCredits = Math.floor(payload.amountMinor / 100);
    const isPaymentSettled = payload.status === "confirmed" && payload.confirmations >= env.usdtConfirmationsRequired;
    const paymentStatus = isPaymentSettled ? "succeeded" : payload.status === "failed" ? "failed" : "pending";

    if (existingPayment) {
      await database
        .update(paymentsTable)
        .set({
          status: paymentStatus,
          rawPayloadJson: JSON.stringify(payload),
          updatedAt: now,
        })
        .where(eq(paymentsTable.id, existingPayment.id));

      return;
    }

    await database.insert(paymentsTable).values({
      id: `pay_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      userId: payload.userId,
      provider: "usdt",
      providerPaymentId,
      status: paymentStatus,
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      creditsPurchased: derivedCredits,
      rawPayloadJson: JSON.stringify(payload),
      createdAt: now,
      updatedAt: now,
    });

    if (isPaymentSettled && derivedCredits > 0) {
      await grantCredits({
        userId: payload.userId,
        deltaCredits: derivedCredits,
        reason: "payment_usdt_confirmed",
        referenceId: providerPaymentId,
        metadataJson: JSON.stringify(payload),
      });
    }
  },
};

const referenceVideos: ReferenceVideo[] = [
  {
    id: "vid_ref_01",
    title: "Neon Future City",
    description: "A cinematic fly-through over a neon-lit skyline at blue hour.",
    prompt: "Cinematic drone shot over a futuristic neon city, volumetric fog, high contrast, smooth camera glide",
    durationSeconds: 8,
    aspectRatio: "16:9",
    thumbnailUrl:
      "https://images.pexels.com/photos/1054218/pexels-photo-1054218.jpeg?auto=compress&cs=tinysrgb&w=1200",
    videoUrl: "https://videos.pexels.com/video-files/3130182/3130182-hd_1920_1080_30fps.mp4",
  },
  {
    id: "vid_ref_02",
    title: "Street Fashion Reel",
    description: "Vertical short with smooth motion and natural lighting.",
    prompt: "Young model walking through urban crosswalk, handheld style, natural movement, social-ready framing",
    durationSeconds: 10,
    aspectRatio: "9:16",
    thumbnailUrl:
      "https://images.pexels.com/photos/3761521/pexels-photo-3761521.jpeg?auto=compress&cs=tinysrgb&w=900",
    videoUrl: "https://videos.pexels.com/video-files/8154917/8154917-hd_1080_1920_24fps.mp4",
  },
  {
    id: "vid_ref_03",
    title: "Product Beauty Macro",
    description: "High-detail macro motion for product marketing creatives.",
    prompt: "Macro lens product beauty shot, slow dolly, soft studio lighting, premium ad aesthetic",
    durationSeconds: 6,
    aspectRatio: "1:1",
    thumbnailUrl:
      "https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg?auto=compress&cs=tinysrgb&w=900",
    videoUrl: "https://videos.pexels.com/video-files/853889/853889-hd_1080_1080_30fps.mp4",
  },
];

const featureHighlights: FeatureHighlight[] = [
  {
    id: "feature_01",
    title: "Text-to-Video + Image-to-Video",
    description: "Use one API surface to generate videos from prompts or animate still images.",
  },
  {
    id: "feature_02",
    title: "Async Jobs with Predictable Polling",
    description: "Create generation jobs and poll status endpoints with simple JSON contracts.",
  },
  {
    id: "feature_03",
    title: "Production-Ready API Key Management",
    description: "Scoped key creation, safe masking, and dashboard-based revocation workflows.",
  },
];

export const siteContentStore = {
  getReferenceVideos(): ReferenceVideo[] {
    return referenceVideos;
  },
  getFeatureHighlights(): FeatureHighlight[] {
    return featureHighlights;
  },
};
