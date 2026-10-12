import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Info, LogOut } from "lucide-react";
import { LoginForm, type MfaFactorOption } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import { marketingOrigin, portalForHost, portalOrigin, safeNextPath } from "@/lib/portal/hosts";
import { getMfaState, getStaffMember, getUser, hasClientMembership, requestHost } from "@/lib/portal/session";
import { siteConfig } from "@/lib/site";
import { isPortalAuthConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to the Largis Venture client portal or Largis Workspace.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const copy = {
  app: {
    label: "Client portal",
    intro: "Sign in to your organisation's Largis client portal. Access is by invitation.",
    other: "Largis staff? Sign in on Largis Workspace",
  },
  staff: {
    label: "Largis Workspace",
    intro: "For Largis Venture employees. Access is by invitation from a staff admin.",
    other: "Client? Sign in on the client portal",
  },
} as const;

export default async function LoginPage({ searchParams }: { searchParams: { email?: string; next?: string } }) {
  const host = requestHost();
  const portal = portalForHost(host) ?? "app";
  const other = portal === "app" ? "staff" : "app";
  const text = copy[portal];
  const next = typeof searchParams.next === "string" ? searchParams.next.slice(0, 200) : "";
  const email = typeof searchParams.email === "string" ? searchParams.email.slice(0, 254) : "";

  const user = await getUser();
  let signedInElsewhere: string | null = null;
  let mfaFactors: MfaFactorOption[] | undefined;
  if (user) {
    const [staff, isClient, mfa] = await Promise.all([getStaffMember(), hasClientMembership(user.id), getMfaState()]);
    const allowed = portal === "staff" ? Boolean(staff) : isClient || !staff;
    if (allowed && mfa?.needsChallenge) {
      mfaFactors = mfa.factors.map((f) => ({ id: f.id, name: f.friendly_name || "Authenticator app" }));
    } else if (allowed) {
      redirect(safeNextPath(next) ?? "/");
    } else {
      signedInElsewhere = user.email ?? "this account";
    }
  }

  const available = isPortalAuthConfigured();
  const website = marketingOrigin(siteConfig.url, host);

  return (
    <div className="flex min-h-screen flex-col bg-paper-soft">
      <header className="bg-gradient-to-b from-night-700 to-night text-white">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Logo href={website} className="shrink-0 [&>span]:hidden sm:[&>span]:inline" />
          <span className="h-5 w-px bg-white/20" aria-hidden="true" />
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-gold-300">{text.label}</span>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-md">
          <div className="border border-line bg-white p-6 sm:p-10">
            <h1 className="text-3xl">Sign in</h1>
            <p className="mt-3 text-[15px] text-ink-muted">{text.intro}</p>

            {signedInElsewhere && (
              <div role="status" className="mt-6 border-l-2 border-gold-500 bg-gold-50 px-4 py-3 text-sm text-ink-muted">
                <p>
                  You&apos;re signed in as <span className="break-all text-ink">{signedInElsewhere}</span>, which
                  doesn&apos;t have access to {text.label}.
                </p>
                <form action="/auth/signout" method="post" className="mt-2">
                  <button type="submit" className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:text-brand-800">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </div>
            )}

            <div className="mt-8">
              {available ? (
                <LoginForm defaultEmail={email} next={next} mfaFactors={mfaFactors} />
              ) : (
                <div role="status" className="flex items-start gap-3 border-l-2 border-gold-500 bg-gold-50 px-4 py-4">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
                  <div className="text-sm leading-relaxed text-ink-muted">
                    <p className="font-medium text-ink">Sign-in is being set up.</p>
                    <p className="mt-1">
                      We are finishing the portal configuration. If you need something in the meantime, email{" "}
                      <a href={`mailto:${siteConfig.email}`} className="text-brand-700 underline underline-offset-4">
                        {siteConfig.email}
                      </a>
                      .
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-2 text-center text-sm text-ink-muted">
            <p>
              <a href={`${portalOrigin(other, host)}/login`} className="underline underline-offset-4 hover:text-ink">
                {text.other}
              </a>
            </p>
            {portal === "app" && (
              <p>
                Not a client yet?{" "}
                <a href={`${website}/contact`} className="text-ink underline underline-offset-4 hover:text-brand-600">
                  Schedule a consultation
                </a>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
