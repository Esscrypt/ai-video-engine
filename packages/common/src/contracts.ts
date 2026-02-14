export interface UserProfile {
  id: string;
  name: string;
  email: string;
  apiCredits: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface LoginResponse {
  user?: UserProfile;
  requiresPasskey?: boolean;
  pendingLoginToken?: string;
  passkeyOptions?: Record<string, unknown>;
}

export interface GoogleStartResponse {
  url: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  maskedKey: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: "active" | "revoked";
}

export interface CreateApiKeyRequest {
  name: string;
}

export interface RotateApiKeyRequest {
  name?: string;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKeySummary;
  rawKey: string;
}

export interface ReferenceVideo {
  id: string;
  title: string;
  description: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
  thumbnailUrl: string;
  videoUrl: string;
}

export interface FeatureHighlight {
  id: string;
  title: string;
  description: string;
}

export interface VideoTaskCreateRequest {
  prompt: string;
  imageUrl?: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
  durationSeconds: number;
}

export interface VideoTask {
  id: string;
  userId: string;
  model: string;
  prompt: string;
  imageUrl: string | null;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
  durationSeconds: number;
  creditsCost: number;
  status: "queued" | "processing" | "succeeded" | "failed";
  providerTaskId: string | null;
  outputVideoUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface VideoTaskCreateResponse {
  task: VideoTask;
  remainingCredits: number;
}

export interface PaymentCheckoutRequest {
  creditsToBuy: number;
}

export interface StripeCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

export interface CryptoWebhookPayload {
  transactionId: string;
  userId: string;
  amountMinor: number;
  currency: string;
  network: string;
  status: "pending" | "confirmed" | "failed";
  confirmations: number;
}

export interface ApplePayIntentRequest {
  creditsToBuy: number;
}

export interface ApplePayIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}
