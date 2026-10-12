"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, KeyRound, Loader2, LogOut, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { siteConfig } from "@/lib/site";

type Step = "email" | "code" | "mfa";

export type MfaFactorOption = { id: string; name: string };

const RESEND_SECONDS = 60;

export function LoginForm({
  defaultEmail = "",
  next = "",
  mfaFactors,
}: {
  defaultEmail?: string;
  next?: string;
  /** Present when the visitor is signed in but still has to pass the authenticator-app step. */
  mfaFactors?: MfaFactorOption[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(mfaFactors?.length ? "mfa" : "email");
  const [factors, setFactors] = useState<MfaFactorOption[]>(mfaFactors ?? []);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [email, setEmail] = useState(defaultEmail);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switchTo, setSwitchTo] = useState<{ label: string; href: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code" || step === "mfa") codeRef.current?.focus();
  }, [step]);

  async function requestCode(address: string) {
    setLoading(true);
    setError(null);
    setSwitchTo(null);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "We couldn't send a code. Please try again.");
        return false;
      }
      setNotice(data.message ?? "If this email has access, a code is on its way.");
      setCooldown(RESEND_SECONDS);
      return true;
    } catch {
      setError(`Network error. Please try again or email ${siteConfig.email}.`);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter your work email address.");
      return;
    }
    setEmail(address);
    if (await requestCode(address)) setStep("code");
  }

  async function onCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = String(new FormData(event.currentTarget).get("token") ?? "").replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) {
      setError("Enter the code from your email.");
      return;
    }

    setLoading(true);
    setError(null);
    setSwitchTo(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, next: next || undefined }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        redirectTo?: string;
        error?: string;
        switchTo?: { label: string; href: string };
        mfaRequired?: boolean;
        factors?: MfaFactorOption[];
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That code is invalid or has expired.");
        setSwitchTo(data.switchTo ?? null);
        setLoading(false);
        return;
      }
      if (data.mfaRequired && data.factors?.length) {
        setFactors(data.factors);
        setRedirectTo(data.redirectTo ?? null);
        setStep("mfa");
        setLoading(false);
        return;
      }
      router.replace(data.redirectTo ?? "/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function onMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").replace(/\s/g, "");
    const factorId = String(form.get("factorId") ?? factors[0]?.id ?? "");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, code, next: redirectTo ?? (next || undefined) }),
      });
      const data = (await res.json()) as { ok: boolean; redirectTo?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That code didn't match. Try again.");
        setLoading(false);
        if (codeRef.current) codeRef.current.value = "";
        codeRef.current?.focus();
        return;
      }
      router.replace(data.redirectTo ?? "/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  const alert = error && (
    <div
      role="alert"
      className="flex items-start gap-2.5 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p>{error}</p>
        {switchTo && (
          <a
            href={switchTo.href}
            className="mt-2 inline-flex items-center gap-1.5 font-medium text-red-900 underline underline-offset-4"
          >
            {switchTo.label}
            <ArrowRight className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );

  if (step === "mfa") {
    return (
      <div className="space-y-6">
        <form onSubmit={onMfaSubmit} noValidate className="space-y-6">
          <div className="flex items-start gap-2.5 border-l-2 border-gold-500 bg-gold-50 px-4 py-3 text-sm text-ink-muted">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
            <span>Two-step verification is on for this account. Enter the current code from your authenticator app.</span>
          </div>
          {alert}
          {factors.length > 1 ? (
            <div>
              <Label htmlFor="factorId">Authenticator</Label>
              <select
                id="factorId"
                name="factorId"
                className="w-full rounded-none border border-[#d6d0c4] bg-white px-4 py-3 text-[15px] text-ink focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                {factors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="factorId" value={factors[0]?.id ?? ""} />
          )}
          <div>
            <Label htmlFor="code">Authenticator code</Label>
            <Input
              ref={codeRef}
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={7}
              placeholder="6-digit code"
              className="font-mono text-lg tracking-[0.3em] placeholder:font-sans placeholder:text-[15px] placeholder:tracking-normal"
              aria-invalid={error ? true : undefined}
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify and continue
          </Button>
          <p className="text-sm text-ink-subtle">
            Lost access to your authenticator app? Email{" "}
            <a href={`mailto:${siteConfig.email}`} className="text-brand-700 underline underline-offset-4">
              {siteConfig.email}
            </a>{" "}
            from your work address and we will reset it after confirming your identity.
          </p>
        </form>
        <form action="/auth/signout" method="post">
          <button type="submit" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <LogOut className="h-4 w-4" />
            Sign out and use a different account
          </button>
        </form>
      </div>
    );
  }

  if (step === "email") {
    return (
      <form onSubmit={onEmailSubmit} noValidate className="space-y-6">
        {alert}
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            required
          />
          <p className="mt-2 text-sm text-ink-subtle">We will email you a one-time code. There is no password.</p>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Email me a code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onCodeSubmit} noValidate className="space-y-6">
      {notice && !error && (
        <div role="status" className="flex items-start gap-2.5 border-l-2 border-gold-500 bg-gold-50 px-4 py-3 text-sm text-ink-muted">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
          <span>
            {notice} Check <span className="break-all text-ink">{email}</span>.
          </span>
        </div>
      )}
      {alert}
      <div>
        <Label htmlFor="token">One-time code</Label>
        <Input
          ref={codeRef}
          id="token"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          placeholder="6-digit code"
          className="font-mono text-lg tracking-[0.3em] placeholder:font-sans placeholder:text-[15px] placeholder:tracking-normal"
          aria-invalid={error ? true : undefined}
          required
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setError(null);
            setSwitchTo(null);
            setNotice(null);
          }}
          className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Use a different email
        </button>
        <button
          type="button"
          onClick={() => requestCode(email)}
          disabled={loading || cooldown > 0}
          className="text-brand-700 underline-offset-4 hover:underline disabled:text-ink-subtle disabled:no-underline"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
