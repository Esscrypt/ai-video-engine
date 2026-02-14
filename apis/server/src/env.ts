const readRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const readOptionalEnv = (key: string, fallback: string): string => {
  return process.env[key] ?? fallback;
};

const readOptionalNumberEnv = (key: string, fallback: number): number => {
  const value = process.env[key];
  if (!value) {
    return fallback;
  }
  const parsedNumber = Number(value);
  if (!Number.isFinite(parsedNumber)) {
    return fallback;
  }
  return parsedNumber;
};

export const env = {
  databaseUrl: readOptionalEnv("DATABASE_URL", "./data/ai-video-engine.sqlite"),
  sessionTtlSeconds: readOptionalNumberEnv("SESSION_TTL_SECONDS", 60 * 60 * 24 * 7),
  initialUserCredits: readOptionalNumberEnv("INITIAL_USER_CREDITS", 300),
  creditsPerTask: readOptionalNumberEnv("CREDITS_PER_TASK", 10),
  seedanceApiBaseUrl: readOptionalEnv("SEEDANCE_API_BASE_URL", "https://seedanceapi.org"),
  seedanceApiKey: readOptionalEnv("SEEDANCE_API_KEY", ""),
  seedanceModel: readOptionalEnv("SEEDANCE_MODEL", "seedance-v2"),
  stripeSecretKey: readOptionalEnv("STRIPE_SECRET_KEY", ""),
  stripeWebhookSecret: readOptionalEnv("STRIPE_WEBHOOK_SECRET", ""),
  stripePriceId: readOptionalEnv("STRIPE_PRICE_ID", ""),
  stripeSuccessUrl: readOptionalEnv("STRIPE_SUCCESS_URL", "http://localhost:3000/dashboard?payment=success"),
  stripeCancelUrl: readOptionalEnv("STRIPE_CANCEL_URL", "http://localhost:3000/pricing?payment=cancelled"),
  stripeApplePayMerchantCountry: readOptionalEnv("STRIPE_APPLE_PAY_MERCHANT_COUNTRY", "US"),
  usdtWebhookSecret: readOptionalEnv("USDT_WEBHOOK_SECRET", ""),
  usdtNetwork: readOptionalEnv("USDT_NETWORK", "TRON"),
  usdtReceiverAddress: readOptionalEnv("USDT_RECEIVER_ADDRESS", ""),
  usdtConfirmationsRequired: readOptionalNumberEnv("USDT_CONFIRMATIONS_REQUIRED", 2),
  passwordResetTokenTtlMinutes: readOptionalNumberEnv("PASSWORD_RESET_TOKEN_TTL_MINUTES", 30),
  passkeyRpId: readOptionalEnv("PASSKEY_RP_ID", "localhost"),
  passkeyRpName: readOptionalEnv("PASSKEY_RP_NAME", "AI Video Engine"),
  passkeyOrigin: readOptionalEnv("PASSKEY_ORIGIN", "http://localhost:3000"),
  googleClientId: readOptionalEnv("GOOGLE_CLIENT_ID", ""),
  googleClientSecret: readOptionalEnv("GOOGLE_CLIENT_SECRET", ""),
  googleRedirectUri: readOptionalEnv("GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/google/callback"),
  nodeEnv: readOptionalEnv("NODE_ENV", "development"),
  requireEnv: readRequiredEnv,
};
