"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/lib/site";

const supabaseEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    if (!email || !password) {
      setError("Enter your work email and password.");
      return;
    }

    if (!supabaseEnabled) {
      router.push("/app/sales-tracker");
      return;
    }

    setLoading(true);
    setError(null);
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authError) {
      setError("Those details did not match an active account.");
      return;
    }
    router.push("/app/sales-tracker");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <a
            href={`mailto:${siteConfig.email}?subject=Password%20reset`}
            className="text-sm text-brand-600 underline-offset-4 hover:underline"
          >
            Forgot password?
          </a>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </Button>

      {!supabaseEnabled && (
        <p className="text-center text-sm text-ink-subtle">
          Demo mode: any email and password open the Sales Tracker preview.
        </p>
      )}
    </form>
  );
}
