import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { PageHeader, Panel } from "@/components/portal/ui";
import { onboardingManager } from "@/lib/onboarding/access";
import { documentNames } from "@/lib/onboarding/files";
import { inputFromOnboarding } from "@/lib/onboarding/schema";
import { portalHref } from "@/lib/portal/hosts";
import { isUuid } from "@/lib/portal/params";
import { requireStaff } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Joining form" };

export default async function EditOnboardingPage({ params }: { params: { id: string } }) {
  await requireStaff();
  const manager = await onboardingManager();
  if (!manager) {
    return (
      <Panel>
        <p className="px-5 py-8 text-sm text-ink-muted">Employee onboarding is limited to admins and managers.</p>
      </Panel>
    );
  }
  if (!isUuid(params.id)) notFound();

  const { data: row } = await createClient().from("employee_onboardings").select("*").eq("id", params.id).maybeSingle();
  if (!row || row.status === "revoked") notFound();

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
          <li>
            <Link href={portalHref(`/staff/onboarding/${row.id}`)} className="hover:text-ink">
              {row.full_name ?? row.invite_name ?? "Record"}
            </Link>
          </li>
        </ol>
      </nav>
      <PageHeader
        eyebrow="Onboarding"
        title={row.full_name ? "Correct joining details" : "Fill in the joining form"}
        description="Same form the employee sees. Saving it here stores the record for payroll."
      />
      <OnboardingForm
        endpoint={`/api/staff/onboarding/${row.id}`}
        uploadEndpoint={`/api/staff/onboarding/${row.id}/document`}
        initialValues={inputFromOnboarding(row)}
        initialFiles={documentNames(row.documents)}
        redirectTo={portalHref(`/staff/onboarding/${row.id}`)}
      />
    </div>
  );
}
