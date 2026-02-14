import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">API Documentation</h1>
      <p className="text-muted-foreground">Use the endpoints below to integrate login, API keys, and media discovery.</p>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/auth/register</code> - creates a new user account.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/auth/login</code> - creates an authenticated session
            cookie.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/auth/forgot-password</code> - generates password reset
            token.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/auth/reset-password</code> - resets user password
            using token.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">GET /api/auth/me</code> - returns the signed-in user profile.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/auth/logout</code> - clears session and cookie.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/auth/passkey/register/options</code> - returns WebAuthn
            options for passkey enrollment.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/auth/passkey/register/verify</code> - verifies passkey
            registration response.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/auth/passkey/login/verify</code> - verifies passkey
            second factor on sign-in.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <code className="rounded bg-muted px-2 py-1">GET /api/keys</code> - lists key metadata and masked values.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/keys</code> - creates a key and returns it once.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">DELETE /api/keys/:keyId</code> - revokes an existing key.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reference Media</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <code className="rounded bg-muted px-2 py-1">GET /api/videos/reference</code> - fetches showcase reference
            videos.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">GET /api/site/features</code> - fetches landing page feature
            highlights.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Video Generation Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/video-tasks</code> - creates a generation task and
            consumes API credits.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">GET /api/video-tasks</code> - lists all user tasks.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">GET /api/video-tasks/:taskId</code> - fetches task status and
            output URL when complete.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments and Credits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/payments/stripe/checkout</code> - creates Stripe
            Checkout Session.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/payments/stripe/apple-pay-intent</code> - creates a
            Stripe payment intent with Apple Pay capable payment methods.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/payments/stripe/webhook</code> - handles Stripe
            completed payment events.
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1">POST /api/payments/crypto/usdt/webhook</code> - processes USDT
            transfer webhooks using HMAC verification.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
