import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, onApiGate } from "@/lib/api";
import { clearAppLock } from "@/lib/lock-store";
import { unregisterPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

export type AuthStatus = "loading" | "signedOut" | "mfa" | "signedIn";

type VerifyResponse = {
  session: { access_token: string; refresh_token: string };
  mfaRequired: boolean;
  factors: { id: string; name: string }[];
};

type AuthValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Verified authenticator-app factors. */
  factors: { id: string; name: string }[];
  /** Bumped when the server reports that an organization now requires two-step verification. */
  enrollmentCheck: number;
  sendCode: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifyCode: (email: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  verifyMfa: (code: string, factorId?: string) => Promise<{ ok: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function verifiedFactors(user: User | null) {
  return (user?.factors ?? [])
    .filter((f) => f.factor_type === "totp" && f.status === "verified")
    .map((f) => ({ id: f.id, name: f.friendly_name || "Authenticator app" }));
}

async function statusFor(session: Session | null): Promise<AuthStatus> {
  if (!session) return "signedOut";
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === "aal2" && data.currentLevel !== "aal2" ? "mfa" : "signedIn";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [enrollmentCheck, setEnrollmentCheck] = useState(0);
  const signingOut = useRef(false);

  const apply = useCallback(async (next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);
    setStatus(await statusFor(next));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      // Supabase calls made inside this callback can deadlock, so apply the change afterwards.
      setTimeout(() => apply(next), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [apply]);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      await unregisterPush();
      await clearAppLock();
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      signingOut.current = false;
      await apply(null);
    }
  }, [apply]);

  useEffect(
    () =>
      onApiGate((code) => {
        if (code === "unauthenticated") signOut();
        else if (code === "mfa_required") setStatus("mfa");
        else setEnrollmentCheck((n) => n + 1);
      }),
    [signOut],
  );

  const sendCode = useCallback(async (email: string) => {
    const result = await api("/api/auth/otp/send", { body: { email }, auth: false });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const result = await api<VerifyResponse>("/api/mobile/auth/verify", { body: { email, code }, auth: false });
      if (!result.ok) return { ok: false, error: result.error };
      const { data, error } = await supabase.auth.setSession(result.session);
      if (error || !data.session) return { ok: false, error: "Sign-in could not be completed. Please try again." };
      await apply(data.session);
      return { ok: true };
    },
    [apply],
  );

  const verifyMfa = useCallback(
    async (code: string, factorId?: string) => {
      const { data } = await supabase.auth.getUser();
      const factor = factorId ?? verifiedFactors(data.user)[0]?.id;
      if (!factor) return { ok: false, error: "No authenticator app is set up for this account." };
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor, code: code.trim() });
      if (error) return { ok: false, error: "That code didn't match. Check the time on your phone and enter the newest code." };
      const { data: fresh } = await supabase.auth.getSession();
      await apply(fresh.session);
      return { ok: true };
    },
    [apply],
  );

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) setUser(data.user);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      user,
      factors: verifiedFactors(user),
      enrollmentCheck,
      sendCode,
      verifyCode,
      verifyMfa,
      refreshUser,
      signOut,
    }),
    [status, session, user, enrollmentCheck, sendCode, verifyCode, verifyMfa, refreshUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
