import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ActivityList } from "@/components/portal/ActivityList";
import { LeadAssistant } from "@/components/portal/LeadAssistant";
import { LeadForm, type LeadRow, type MemberOption } from "@/components/portal/LeadsManager";
import { LeadTasks, type TaskRow } from "@/components/portal/LeadTasks";
import { PageHeader } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { isAssistantConfigured } from "@/lib/revenue/ai";
import { leadTitle, stageLabel, type PipelineStageView } from "@/lib/revenue/stages";
import type { RolePermissions } from "@/lib/portal/meta";
import { stageMeta } from "@/lib/portal/meta";
import type { Profile } from "@/lib/portal/format";
import type { SuggestionRow } from "@/components/portal/LeadAssistant";

export function LeadRecord({
  organizationId,
  lead,
  stages,
  members,
  tasks,
  suggestions,
  activity,
  profiles,
  perms,
  currentUserId,
  backHref,
  leadBase,
  usage,
}: {
  organizationId: string;
  lead: LeadRow;
  stages: PipelineStageView[];
  members: MemberOption[];
  tasks: TaskRow[];
  suggestions: SuggestionRow[];
  activity: { id: string; action: string; actor_id: string | null; metadata: unknown; created_at: string }[];
  profiles: Map<string, Profile>;
  perms: RolePermissions;
  currentUserId: string;
  backHref: string;
  leadBase: string;
  usage: { used: number; cap: number };
}) {
  const canEdit = perms.canEdit && (!perms.ownOnly || lead.owner_id === currentUserId);
  const title = leadTitle(lead);

  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="h-4 w-4" />
        All leads
      </Link>
      <PageHeader
        eyebrow="RevenueDesk"
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={stageMeta[lead.stage].tone}>{stageLabel(stages, lead.stage)}</Badge>
            {lead.job_type && <span>{lead.job_type}</span>}
            {lead.phone && <span>{lead.phone}</span>}
          </span>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-6">
          <section className="border border-line bg-white p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold">Lead</h2>
            <div className="mt-4">
              <LeadForm
                key={`${lead.id}-${lead.updated_at}`}
                organizationId={organizationId}
                lead={lead}
                members={members}
                stages={stages}
                perms={perms}
                leadBase={leadBase}
                readOnly={!canEdit}
              />
            </div>
          </section>
          <LeadTasks
            organizationId={organizationId}
            leadId={lead.id}
            tasks={tasks}
            members={members}
            perms={perms}
            canEdit={canEdit}
          />
        </div>
        <div className="space-y-6">
          <LeadAssistant
            organizationId={organizationId}
            leadId={lead.id}
            suggestions={suggestions}
            used={usage.used}
            cap={usage.cap}
            configured={isAssistantConfigured()}
            canEdit={canEdit}
          />
          <section className="border border-line bg-white">
            <div className="border-b border-line px-4 py-3 sm:px-5">
              <h2 className="text-[15px] font-semibold">Activity</h2>
            </div>
            <ActivityList items={activity} profiles={profiles} />
          </section>
        </div>
      </div>
    </div>
  );
}
