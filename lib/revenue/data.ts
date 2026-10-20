import "server-only";
import { displayName } from "@/lib/portal/format";
import { getProfiles } from "@/lib/portal/session";
import { leadColumns } from "@/lib/portal/queries";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/lib/supabase/types";
import { AI_SUGGESTION_CAP, defaultPipeline, usageMonth, type PipelineStageView } from "@/lib/revenue/stages";

export async function loadPipelineStages(organizationId: string): Promise<PipelineStageView[]> {
  const { data, error } = await createClient()
    .from("organization_pipeline_stages")
    .select("stage, label, position, hidden")
    .eq("organization_id", organizationId);
  if (error || !data?.length) return defaultPipeline;
  return data.map((stage) => ({
    stage: stage.stage,
    label: stage.label,
    position: stage.position,
    hidden: stage.hidden,
  }));
}

export async function loadOverdueLeadIds(organizationId: string) {
  const { data } = await createClient()
    .from("lead_tasks")
    .select("lead_id")
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .not("due_at", "is", null)
    .lt("due_at", new Date().toISOString());
  return Array.from(new Set((data ?? []).map((task) => task.lead_id)));
}

export async function loadOverdueTaskCount(organizationId: string) {
  const { count } = await createClient()
    .from("lead_tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .not("due_at", "is", null)
    .lt("due_at", new Date().toISOString());
  return count ?? 0;
}

export async function loadAiUsage(organizationId: string) {
  const { data } = await createClient()
    .from("organization_ai_usage")
    .select("count")
    .eq("organization_id", organizationId)
    .eq("month", usageMonth())
    .maybeSingle();
  return { used: data?.count ?? 0, cap: AI_SUGGESTION_CAP };
}

export async function loadOrgMembers(organizationId: string) {
  const { data: memberships } = await createClient().from("memberships").select("user_id").eq("organization_id", organizationId);
  const profiles = await getProfiles((memberships ?? []).map((member) => member.user_id));
  return (memberships ?? [])
    .map((member) => ({ id: member.user_id, name: displayName(profiles.get(member.user_id)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function monthStartUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type SourceCount = { source: string; count: number };

export function leadsBySource(sources: (string | null)[]): SourceCount[] {
  const counts = new Map<string, number>();
  for (const source of sources) {
    const key = source?.trim() || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

export function medianHoursToContact(
  leads: { created_at: string; first_contacted_at: string | null }[],
  monthStart: Date,
) {
  const hours = leads
    .filter((lead) => lead.first_contacted_at && new Date(lead.first_contacted_at) >= monthStart)
    .map((lead) => (new Date(lead.first_contacted_at!).getTime() - new Date(lead.created_at).getTime()) / 36e5)
    .filter((value) => value >= 0)
    .sort((a, b) => a - b);
  if (!hours.length) return null;
  const mid = Math.floor(hours.length / 2);
  return hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2;
}

export function formatDurationHours(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
  return `${rounded} hr`;
}

export type StageCount = Record<LeadStage, number>;

export async function loadLeadDetail(organizationId: string, leadId: string) {
  const supabase = createClient();
  const [leadResult, tasksResult, suggestionsResult, activityResult, stages, members, usage] = await Promise.all([
    supabase.from("leads").select(leadColumns).eq("id", leadId).eq("organization_id", organizationId).maybeSingle(),
    supabase
      .from("lead_tasks")
      .select("id, title, owner_id, due_at, status")
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId)
      .order("status", { ascending: true })
      .order("due_at", { ascending: true }),
    supabase
      .from("lead_suggestions")
      .select("id, kind, body, status, created_at")
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("activity_log")
      .select("id, action, actor_id, metadata, created_at")
      .eq("organization_id", organizationId)
      .eq("entity", "lead")
      .eq("entity_id", leadId)
      .order("created_at", { ascending: false })
      .limit(40),
    loadPipelineStages(organizationId),
    loadOrgMembers(organizationId),
    loadAiUsage(organizationId),
  ]);

  return {
    lead: leadResult.data,
    error: leadResult.error,
    tasks: tasksResult.data ?? [],
    suggestions: suggestionsResult.data ?? [],
    activity: activityResult.data ?? [],
    stages,
    members,
    usage,
  };
}
