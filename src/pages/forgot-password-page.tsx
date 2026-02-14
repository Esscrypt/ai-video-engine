import { NavLink } from "@/components/nav-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api-client";
import { isAllowedEmail } from "@viralvector/common/email-validation";
import { useAuth } from "@/context/auth-context";
import { useMemo, useState, type FormEvent } from "react";

interface ForgotPasswordPageProps {
  pathname: string;
}

const getResetTokenQueryValue = (): string => {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("token") ?? "";
};

export default function ForgotPasswordPage({ pathname }: ForgotPasswordPageProps) {
  const { forgotPassword, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetTokenInput, setResetTokenInput] = useState("");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tokenFromQuery = useMemo(() => getResetTokenQueryValue(), [pathname]);

  const onRequestToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInfoMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (!isAllowedEmail(email)) {
        throw new ApiClientError("Enter a valid email without + aliases.", 400);
      }

      const response = await forgotPassword({ email });
      if (response.resetToken) {
        setInfoMessage(`Reset token (dev): ${response.resetToken}`);
      } else {
        setInfoMessage("If this email exists, a reset link has been sent.");
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Could not request password reset.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInfoMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await resetPassword({
        token: resetTokenInput || tokenFromQuery,
        password: newPassword,
      });
      setInfoMessage("Password updated. You can now sign in.");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Could not reset password.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>Request a reset token.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onRequestToken}>
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Send reset token
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Use your token and choose a new password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onResetPassword}>
            <div className="space-y-2">
              <Label htmlFor="token">Reset token</Label>
              <Input
                id="token"
                value={resetTokenInput || tokenFromQuery}
                onChange={event => setResetTokenInput(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Update password
            </Button>
            <p className="text-sm text-muted-foreground">
              Back to{" "}
              <NavLink href="/login" className="text-primary">
                login
              </NavLink>
            </p>
          </form>
        </CardContent>
      </Card>

      {infoMessage ? <p className="md:col-span-2 text-sm text-primary">{infoMessage}</p> : null}
      {errorMessage ? <p className="md:col-span-2 text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
