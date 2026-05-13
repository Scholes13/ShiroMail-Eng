import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthErrorMessage, resendEmailVerification, resetPassword } from "../api";
import { composePageTitle, usePageTitle } from "../../../hooks/use-page-title";
import { useSiteName } from "../../../hooks/use-site-name";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ticket, setTicket] = useState(searchParams.get("ticket") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [nextPassword, setNextPassword] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const siteName = useSiteName();
  usePageTitle(composePageTitle("Text", siteName));

  async function handleSubmit() {
    if (submitPending || resendPending) {
      return;
    }
    setSubmitPending(true);
    setError(null);
    setNotice(null);
    try {
      await resetPassword({
        verificationTicket: ticket,
        code,
        newPassword: nextPassword,
      });
      setNotice("Text，Text。");
      window.setTimeout(() => navigate("/", { replace: true }), 1200);
    } catch (currentError) {
      setError(getAuthErrorMessage(currentError, "Text，Textverification codeText。"));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleResend() {
    if (submitPending || resendPending) {
      return;
    }
    setResendPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await resendEmailVerification({ verificationTicket: ticket });
      setTicket(result.verificationTicket);
      setEmail(result.email);
      setNotice(`verification codeText ${result.email}`);
    } catch (currentError) {
      setError(getAuthErrorMessage(currentError, "verification codeText。"));
    } finally {
      setResendPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6">
        <div className="space-y-2">
          <p className="text-base font-semibold text-foreground">Text</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {email
              ? `Text ${email} Textverification code。Text。`
              : "Textverification codeText。"}
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <Input
            aria-label="Textverification code"
            inputMode="numeric"
            placeholder="Text 6 Textverification code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Input
            aria-label="Text"
            autoComplete="new-password"
            placeholder="Text"
            type="password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
          />

          {notice ? <p className="text-xs text-emerald-600">{notice}</p> : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <Button
            className="w-full"
            disabled={submitPending || resendPending || !ticket || code.trim().length < 6 || nextPassword.trim().length < 8}
            onClick={handleSubmit}
          >
            {submitPending ? "Text..." : "Text"}
          </Button>
          <Button className="w-full" disabled={submitPending || resendPending || !ticket} variant="outline" onClick={handleResend}>
            {resendPending ? "Text..." : "Textverification code"}
          </Button>

          <div className="pt-1 text-center text-xs text-muted-foreground">
            <Link className="underline underline-offset-4" to="/">
              Text
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
