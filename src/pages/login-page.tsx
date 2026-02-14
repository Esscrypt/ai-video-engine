import { startAuthentication } from "@simplewebauthn/browser";
import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api-client";
import { isAllowedEmail } from "@viralvector/common/email-validation";
import { useAuth } from "@/context/auth-context";
import { navigateToPath } from "@/lib/router";
import { useMemo, useState, type FormEvent } from "react";

interface LoginPageProps {
  pathname: string;
}

const getRedirectPath = (): string => {
  const searchParams = new URLSearchParams(window.location.search);
  const requestedPath = searchParams.get("next");
  if (!requestedPath || !requestedPath.startsWith("/")) {
    return "/dashboard";
  }
  return requestedPath;
};

export default function LoginPage({ pathname }: LoginPageProps) {
  const { user, getGoogleLoginUrl, login, verifyPasskeyLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const urlParams = new URLSearchParams(window.location.search);
  const googleError = urlParams.get("google_error");
  const redirectPath = useMemo(() => getRedirectPath(), [pathname]);

  if (user) {
    navigateToPath(redirectPath);
    return null;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!isAllowedEmail(email)) {
        throw new ApiClientError("Enter a valid email without + aliases.", 400);
      }

      const loginResponse = await login({ email, password });
      if (loginResponse.requiresPasskey && loginResponse.pendingLoginToken && loginResponse.passkeyOptions) {
        const passkeyAssertion = await startAuthentication({
          optionsJSON: loginResponse.passkeyOptions as any,
        });
        await verifyPasskeyLogin(loginResponse.pendingLoginToken, passkeyAssertion as unknown as Record<string, unknown>);
      }
      navigateToPath(redirectPath);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unexpected error during login.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onGoogleLogin = async () => {
    setErrorMessage(null);
    setIsGoogleSubmitting(true);
    try {
      const googleLoginUrl = await getGoogleLoginUrl(redirectPath);
      window.location.href = googleLoginUrl;
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Could not start Google login.");
      }
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Sign in with your email/password or Google account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
              />
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            {googleError ? <p className="text-sm text-destructive">Google login failed. Please try again.</p> : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={onGoogleLogin} disabled={isGoogleSubmitting}>
              {isGoogleSubmitting ? "Redirecting..." : "Continue with Google"}
            </Button>
            <div className="flex justify-between text-sm">
              <NavLink href="/register" className="text-primary">
                Create account
              </NavLink>
              <NavLink href="/forgot-password" className="text-primary">
                Forgot password?
              </NavLink>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
