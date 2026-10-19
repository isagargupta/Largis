import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecordView } from "@/components/onboarding/RecordView";
import { Panel } from "@/components/portal/ui";
import { onboardingManager } from "@/lib/onboarding/access";
import { onboardingJoinUrl } from "@/lib/onboarding/data";
import { displayName } from "@/lib/portal/format";
import { isUuid } from "@/lib/portal/params";
import { getProfiles, requireStaff } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Onboarding record" };

export default async function OnboardingRecordPage({ params }: { params: { id: string } }) {
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

  const supabase = createClient();
  const { data: row } = await supabase.from("employee_onboardings").select("*").eq("id", params.id).maybeSingle();
  if (!row) notFound();
  const profiles = await getProfiles([row.reviewed_by]);

  return <RecordView row={row} joinUrl={onboardingJoinUrl(row.token)} reviewer={row.reviewed_by ? displayName(profiles.get(row.reviewed_by)) : null} />;
}
