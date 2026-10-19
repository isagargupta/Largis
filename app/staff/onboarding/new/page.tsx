import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { InviteForm } from "@/components/onboarding/InviteForm";
import { PageHeader, Panel } from "@/components/portal/ui";
import { onboardingManager } from "@/lib/onboarding/access";
import { portalHref } from "@/lib/portal/hosts";
import { requireStaff } from "@/lib/portal/session";

export const metadata: Metadata = { title: "New hire" };

export default async function NewOnboardingPage() {
  await requireStaff();
  const manager = await onboardingManager();
  if (!manager) {
    return (
      <Panel>
        <p className="px-5 py-8 text-sm text-ink-muted">Employee onboarding is limited to admins and managers.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-ink-subtle">
          <li>
            <Link href={portalHref("/staff/onboarding")} className="hover:text-ink">
              Onboarding
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li className="text-ink">New hire</li>
        </ol>
      </nav>
      <PageHeader
        eyebrow="Onboarding"
        title="Start a joining form"
        description="We'll email them a private joining link. They enter their identity, bank account, and marksheets. The link also stays on the next screen if you want to copy it."
      />
      <Panel title="Who is joining?">
        <div className="px-5 py-5">
          <InviteForm />
        </div>
      </Panel>
    </div>
  );
}
