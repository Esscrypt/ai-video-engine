import { createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import type {
  ApplePayIntentRequest,
  CreateApiKeyRequest,
  CryptoWebhookPayload,
  ForgotPasswordRequest,
  GoogleStartResponse,
  LoginRequest,
  PaymentCheckoutRequest,
  RegisterRequest,
  RotateApiKeyRequest,
  ResetPasswordRequest,
  VideoTaskCreateRequest,
} from "@viralvector/common/contracts";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  emptyResponse,
  getCookieValue,
  jsonResponse,
  readJsonBody,
  withSessionCookie,
} from "./http";
import { apiKeyService, authStore, paymentService, siteContentStore, videoTaskService } from "./store";
import { env } from "./env";

const BAD_REQUEST_RESPONSE = jsonResponse({ error: "Invalid request payload." }, { status: 400 });
const UNAUTHORIZED_RESPONSE = jsonResponse({ error: "Authentication required." }, { status: 401 });
type ParametrizedBunRequest = Request & { params: Record<string, string | undefined> };

const stripeClient = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

const isSupportedAspectRatio = (aspectRatio: string): boolean => {
  return ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"].includes(aspectRatio);
};

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const isAllowedEmail = (email: string): boolean => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return false;
  }

  const [localPart = ""] = normalizedEmail.split("@");
  if (localPart.includes("+")) {
    return false;
  }

  return true;
};

const isValidHmacSignature = (payload: string, signature: string, secret: string): boolean => {
  const digest = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  const expected = Buffer.from(digest, "utf8");
  const provided = Buffer.from(signature, "utf8");
  if (expected.length !== provided.length) {
    return false;
  }
  return timingSafeEqual(expected, provided);
};

const getAuthenticatedUser = async (request: Request) => {
  const sessionId = getCookieValue(request, SESSION_COOKIE_NAME);
  const user = await authStore.getUserBySession(sessionId);
  return { sessionId, user };
};

const createNotFoundResponse = (resourceName: string): Response => {
  return jsonResponse({ error: `${resourceName} was not found.` }, { status: 404 });
};

const createRedirectResponse = (url: string): Response => {
  return Response.redirect(url, 302);
};

export const apiRoutes = {
  "/api/health": {
    async GET() {
      return jsonResponse({ status: "ok" });
    },
  },

  "/api/site/features": {
    async GET() {
      return jsonResponse({
        items: siteContentStore.getFeatureHighlights(),
      });
    },
  },

  "/api/videos/reference": {
    async GET() {
      return jsonResponse({
        items: siteContentStore.getReferenceVideos(),
      });
    },
  },

  "/api/auth/login": {
    async POST(request: Request) {
      const requestBody = await readJsonBody<LoginRequest>(request);
      if (!requestBody) {
        return BAD_REQUEST_RESPONSE;
      }

      const email = requestBody.email?.trim().toLowerCase();
      const password = requestBody.password?.trim();
      if (!email || !password || !isAllowedEmail(email)) {
        return BAD_REQUEST_RESPONSE;
      }

      const loginResult = await authStore.login(email, password);
      if (!loginResult) {
        return jsonResponse({ error: "Invalid email or password." }, { status: 401 });
      }

      const response = jsonResponse(loginResult.response, { status: 200 });
      if (!loginResult.sessionId) {
        return response;
      }
      return withSessionCookie(response, loginResult.sessionId, authStore.sessionMaxAgeSeconds);
    },
  },

  "/api/auth/register": {
    async POST(request: Request) {
      const requestBody = await readJsonBody<RegisterRequest>(request);
      if (!requestBody) {
        return BAD_REQUEST_RESPONSE;
      }

      const name = requestBody.name?.trim();
      const email = requestBody.email?.trim().toLowerCase();
      const password = requestBody.password?.trim();
      if (!name || !email || !password || password.length < 8 || !isAllowedEmail(email)) {
        return jsonResponse({ error: "Invalid registration payload." }, { status: 400 });
      }

      try {
        const user = await authStore.register({ name, email, password });
        return jsonResponse({ user }, { status: 201 });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Email already registered")) {
          return jsonResponse({ error: "Email already registered." }, { status: 409 });
        }
        return jsonResponse({ error: "Registration failed." }, { status: 500 });
      }
    },
  },

  "/api/auth/google/start": {
    async GET(request: Request) {
      try {
        const url = new URL(request.url);
        const nextPath = url.searchParams.get("next") ?? "/dashboard";
        const authUrl = authStore.createGoogleStartUrl(nextPath);
        const response: GoogleStartResponse = { url: authUrl };
        return jsonResponse(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not start Google login.";
        return jsonResponse({ error: message }, { status: 500 });
      }
    },
  },

  "/auth/google/callback": {
    async GET(request: Request) {
      const url = new URL(request.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) {
        return createRedirectResponse("/login?google_error=missing_code_or_state");
      }

      try {
        const googleLogin = await authStore.loginWithGoogleCode(code, state);
        if (!googleLogin) {
          return createRedirectResponse("/login?google_error=invalid_oauth_callback");
        }

        const redirectResponse = createRedirectResponse(googleLogin.nextPath);
        return withSessionCookie(redirectResponse, googleLogin.sessionId, authStore.sessionMaxAgeSeconds);
      } catch {
        return createRedirectResponse("/login?google_error=oauth_failed");
      }
    },
  },

  "/api/auth/forgot-password": {
    async POST(request: Request) {
      const requestBody = await readJsonBody<ForgotPasswordRequest>(request);
      if (!requestBody?.email || !isAllowedEmail(requestBody.email)) {
        return BAD_REQUEST_RESPONSE;
      }

      const token = await authStore.createForgotPasswordToken(requestBody.email.trim().toLowerCase());
      return jsonResponse({
        success: true,
        resetToken: env.nodeEnv === "production" ? undefined : token,
      });
    },
  },

  "/api/auth/reset-password": {
    async POST(request: Request) {
      const requestBody = await readJsonBody<ResetPasswordRequest>(request);
      if (!requestBody?.token || !requestBody.password || requestBody.password.length < 8) {
        return BAD_REQUEST_RESPONSE;
      }

      const success = await authStore.resetPassword({
        token: requestBody.token,
        password: requestBody.password,
      });
      if (!success) {
        return jsonResponse({ error: "Invalid or expired reset token." }, { status: 400 });
      }
      return jsonResponse({ success: true });
    },
  },

  "/api/auth/passkey/register/options": {
    async POST(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }
      const options = await authStore.createPasskeyRegistrationOptions(user.id);
      return jsonResponse(options);
    },
  },

  "/api/auth/passkey/register/verify": {
    async POST(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }
      const requestBody = await readJsonBody<{ token: string; response: RegistrationResponseJSON }>(request);
      if (!requestBody?.token || !requestBody.response) {
        return BAD_REQUEST_RESPONSE;
      }
      const verified = await authStore.verifyPasskeyRegistration(requestBody.token, requestBody.response);
      if (!verified) {
        return jsonResponse({ error: "Passkey verification failed." }, { status: 400 });
      }
      return jsonResponse({ success: true });
    },
  },

  "/api/auth/passkey/login/verify": {
    async POST(request: Request) {
      const requestBody = await readJsonBody<{ pendingLoginToken: string; response: AuthenticationResponseJSON }>(request);
      if (!requestBody?.pendingLoginToken || !requestBody.response) {
        return BAD_REQUEST_RESPONSE;
      }
      const verifiedLogin = await authStore.verifyPasskeySecondFactor(requestBody.pendingLoginToken, requestBody.response);
      if (!verifiedLogin) {
        return jsonResponse({ error: "Passkey authentication failed." }, { status: 401 });
      }

      const response = jsonResponse({ user: verifiedLogin.user }, { status: 200 });
      return withSessionCookie(response, verifiedLogin.sessionId, authStore.sessionMaxAgeSeconds);
    },
  },

  "/api/auth/me": {
    async GET(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }
      return jsonResponse({ user });
    },
  },

  "/api/auth/logout": {
    async POST(request: Request) {
      const { sessionId } = await getAuthenticatedUser(request);
      authStore.logout(sessionId);
      const response = emptyResponse({ status: 204 });
      return clearSessionCookie(response);
    },
  },

  "/api/keys": {
    async GET(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }
      return jsonResponse({ items: await apiKeyService.list(user.id) });
    },

    async POST(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }

      const requestBody = await readJsonBody<CreateApiKeyRequest>(request);
      if (!requestBody) {
        return BAD_REQUEST_RESPONSE;
      }

      const apiKeyName = requestBody.name?.trim();
      if (!apiKeyName) {
        return BAD_REQUEST_RESPONSE;
      }

      const createdApiKey = await apiKeyService.create(user.id, apiKeyName);
      return jsonResponse(createdApiKey, { status: 201 });
    },
  },

  "/api/keys/:keyId": {
    async DELETE(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }

      const keyId = (request as ParametrizedBunRequest).params.keyId?.trim();
      if (!keyId) {
        return BAD_REQUEST_RESPONSE;
      }

      const isRevoked = await apiKeyService.revoke(user.id, keyId);
      if (!isRevoked) {
        return createNotFoundResponse("API key");
      }

      return emptyResponse({ status: 204 });
    },
  },

  "/api/keys/:keyId/rotate": {
    async POST(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }

      const keyId = (request as ParametrizedBunRequest).params.keyId?.trim();
      if (!keyId) {
        return BAD_REQUEST_RESPONSE;
      }

      const requestBody = await readJsonBody<RotateApiKeyRequest>(request);
      const rotatedApiKey = await apiKeyService.rotate(user.id, keyId, requestBody?.name);
      if (!rotatedApiKey) {
        return createNotFoundResponse("Active API key");
      }

      return jsonResponse(rotatedApiKey, { status: 201 });
    },
  },

  "/api/video-tasks": {
    async GET(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }

      const tasks = await videoTaskService.listByUser(user.id);
      return jsonResponse({ items: tasks });
    },

    async POST(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }

      const requestBody = await readJsonBody<VideoTaskCreateRequest>(request);
      if (!requestBody) {
        return BAD_REQUEST_RESPONSE;
      }

      const prompt = requestBody.prompt?.trim();
      if (!prompt || !isSupportedAspectRatio(requestBody.aspectRatio) || !Number.isFinite(requestBody.durationSeconds)) {
        return BAD_REQUEST_RESPONSE;
      }

      try {
        const createdTask = await videoTaskService.create(user.id, {
          prompt,
          imageUrl: requestBody.imageUrl?.trim() || undefined,
          aspectRatio: requestBody.aspectRatio,
          durationSeconds: requestBody.durationSeconds,
        });
        return jsonResponse(createdTask, { status: 201 });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Insufficient API credits")) {
          return jsonResponse({ error: "Insufficient API credits." }, { status: 402 });
        }
        return jsonResponse({ error: "Could not create video generation task." }, { status: 500 });
      }
    },
  },

  "/api/video-tasks/:taskId": {
    async GET(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }

      const taskId = (request as ParametrizedBunRequest).params.taskId?.trim();
      if (!taskId) {
        return BAD_REQUEST_RESPONSE;
      }

      const task = await videoTaskService.getById(user.id, taskId);
      if (!task) {
        return createNotFoundResponse("Video task");
      }
      return jsonResponse({ task });
    },
  },

  "/api/payments/stripe/checkout": {
    async POST(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }

      const requestBody = await readJsonBody<PaymentCheckoutRequest>(request);
      if (!requestBody || !Number.isFinite(requestBody.creditsToBuy) || requestBody.creditsToBuy <= 0) {
        return BAD_REQUEST_RESPONSE;
      }

      try {
        const checkout = await paymentService.createStripeCheckoutSession(user.id, Math.round(requestBody.creditsToBuy));
        return jsonResponse(checkout);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stripe checkout creation failed.";
        return jsonResponse({ error: message }, { status: 500 });
      }
    },
  },

  "/api/payments/stripe/apple-pay-intent": {
    async POST(request: Request) {
      const { user } = await getAuthenticatedUser(request);
      if (!user) {
        return UNAUTHORIZED_RESPONSE;
      }

      const requestBody = await readJsonBody<ApplePayIntentRequest>(request);
      if (!requestBody || !Number.isFinite(requestBody.creditsToBuy) || requestBody.creditsToBuy <= 0) {
        return BAD_REQUEST_RESPONSE;
      }

      try {
        const paymentIntent = await paymentService.createApplePayIntent(user.id, Math.round(requestBody.creditsToBuy));
        return jsonResponse(paymentIntent);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Apple Pay intent creation failed.";
        return jsonResponse({ error: message }, { status: 500 });
      }
    },
  },

  "/api/payments/stripe/webhook": {
    async POST(request: Request) {
      if (!stripeClient || !env.stripeWebhookSecret) {
        return jsonResponse({ error: "Stripe webhook configuration is missing." }, { status: 500 });
      }

      const signature = request.headers.get("stripe-signature");
      if (!signature) {
        return BAD_REQUEST_RESPONSE;
      }

      const payload = await request.text();
      let event: Stripe.Event;
      try {
        event = stripeClient.webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
      } catch {
        return jsonResponse({ error: "Invalid stripe webhook signature." }, { status: 400 });
      }

      await paymentService.handleStripeEvent(event);
      return emptyResponse({ status: 204 });
    },
  },

  "/api/payments/crypto/usdt/webhook": {
    async POST(request: Request) {
      if (!env.usdtWebhookSecret) {
        return jsonResponse({ error: "USDT webhook configuration is missing." }, { status: 500 });
      }

      const signature = request.headers.get("x-usdt-signature");
      if (!signature) {
        return BAD_REQUEST_RESPONSE;
      }

      const payloadText = await request.text();
      if (!isValidHmacSignature(payloadText, signature, env.usdtWebhookSecret)) {
        return jsonResponse({ error: "Invalid USDT webhook signature." }, { status: 400 });
      }

      let payload: CryptoWebhookPayload;
      try {
        payload = JSON.parse(payloadText) as CryptoWebhookPayload;
      } catch {
        return BAD_REQUEST_RESPONSE;
      }

      if (!payload.userId || !payload.transactionId || !payload.currency || !payload.network) {
        return BAD_REQUEST_RESPONSE;
      }

      await paymentService.handleUsdtPayment(payload);
      return emptyResponse({ status: 204 });
    },
  },
} satisfies Record<string, any>;
