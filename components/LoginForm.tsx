"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { siteConfig } from "@/lib/site";

type Step = "email" | "code";

const RESEND_SECONDS = 60;

export function LoginForm({ defaultEmail = "", next = "" }: { defaultEmail?: string; next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
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
    if (step === "code") codeRef.current?.focus();
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
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That code is invalid or has expired.");
        setSwitchTo(data.switchTo ?? null);
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
