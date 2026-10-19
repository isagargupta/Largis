import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { loadOnboardingByToken } from "@/lib/onboarding/data";
import { ONBOARDING_TOKEN } from "@/lib/onboarding/files";
import { inputFromOnboarding } from "@/lib/onboarding/schema";

export const metadata: Metadata = { title: "Joining Largis", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: { token: string } }) {
  if (!ONBOARDING_TOKEN.test(params.token)) return <Notice title="This link isn't valid." body="Check the address, or ask the person who sent it for a new one." />;

  const loaded = await loadOnboardingByToken(params.token);
  if (loaded.kind === "invalid") return <Notice title="This link isn't valid." body="Check the address, or ask the person who sent it for a new one." />;
  if (loaded.kind === "unavailable") return <Notice title="The form is temporarily unavailable." body="Please try again a little later, or ask Largis to send the link again." />;
  if (loaded.kind === "closed") return <Notice title="This link is no longer active." body="It may have expired or been withdrawn. Ask the person who sent it for a new one." />;
  if (loaded.kind === "done") {
    return (
      <div className="border border-line bg-white px-6 py-10 sm:px-10" role="status">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        <h1 className="mt-6 text-3xl tracking-[-0.03em]">We&apos;ve received your details.</h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-muted">
          HR has your joining information. This link won&apos;t show the form again. We&apos;ll contact you if anything is missing.
        </p>
      </div>
    );
  }

  const expiresLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(loaded.row.expires_at));

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-subtle">Largis Venture</p>
        <h1 className="mt-3 text-3xl tracking-[-0.03em] sm:text-4xl">Joining form</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">
          Tell us who you are, where salary should be credited, and upload your marksheets. Class 10 and Class 12 are required. College is required only if you have a qualification.
        </p>
      </div>
      <noscript>
        <p className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">This form needs JavaScript so your documents can be uploaded.</p>
      </noscript>
      <OnboardingForm
        endpoint={`/api/join/${params.token}`}
        uploadEndpoint={`/api/join/${params.token}/document`}
        initialValues={inputFromOnboarding(loaded.row)}
        initialFiles={loaded.files}
        expiresLabel={expiresLabel}
      />
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-line bg-white px-6 py-10 sm:px-10">
      <h1 className="text-3xl tracking-[-0.03em]">{title}</h1>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
