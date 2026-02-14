import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NavLink } from "@/components/nav-link";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";

export default function DashboardHomePage() {
  const { user, getPasskeyRegistrationOptions, verifyPasskeyRegistration } = useAuth();
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  const [isPasskeySubmitting, setIsPasskeySubmitting] = useState(false);

  const onEnablePasskey = async () => {
    setIsPasskeySubmitting(true);
    setPasskeyMessage(null);

    try {
      const registrationChallenge = await getPasskeyRegistrationOptions();
      const registrationResponse = await startRegistration({
        optionsJSON: registrationChallenge.options as any,
      });
      await verifyPasskeyRegistration(
        registrationChallenge.token,
        registrationResponse as unknown as Record<string, unknown>,
      );
      setPasskeyMessage("Passkey enabled. Next login requires passkey 2FA.");
    } catch (_error) {
      setPasskeyMessage("Could not enable passkey right now.");
    } finally {
      setIsPasskeySubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back{user ? `, ${user.name}` : ""}. Manage API keys and browse generation references.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Create, inspect, and revoke project keys.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <NavLink href="/dashboard/api-keys">Open API Keys</NavLink>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reference Videos</CardTitle>
            <CardDescription>Review sample outputs and prompts for style calibration.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <NavLink href="/dashboard/videos">Open Video Gallery</NavLink>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Passkey 2FA</CardTitle>
            <CardDescription>Add a passkey as second factor after password login.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={onEnablePasskey} disabled={isPasskeySubmitting}>
              {isPasskeySubmitting ? "Enabling..." : "Enable passkey 2FA"}
            </Button>
            {passkeyMessage ? <p className="text-sm text-muted-foreground">{passkeyMessage}</p> : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
