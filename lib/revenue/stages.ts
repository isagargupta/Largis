import type { AssignmentMode, LeadStage } from "@/lib/supabase/types";

/** Every stored stage, in the default pipeline order. */
export const leadStages = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;
export const pipelineStageOrder: LeadStage[] = [...leadStages];

export const lockedStages: LeadStage[] = ["new", "won", "lost"];

export type PipelineStageView = {
  stage: LeadStage;
  label: string;
  position: number;
  hidden: boolean;
};

export const defaultPipeline: PipelineStageView[] = [
  { stage: "new", label: "New", position: 0, hidden: false },
  { stage: "contacted", label: "Contacted", position: 1, hidden: true },
  { stage: "qualified", label: "Qualified", position: 2, hidden: false },
  { stage: "proposal", label: "Proposal", position: 3, hidden: false },
  { stage: "negotiation", label: "Negotiation", position: 4, hidden: false },
  { stage: "won", label: "Won", position: 5, hidden: false },
  { stage: "lost", label: "Lost", position: 6, hidden: false },
];

export const homeServicePipeline: PipelineStageView[] = [
  { stage: "new", label: "New", position: 0, hidden: false },
  { stage: "contacted", label: "Contacted", position: 1, hidden: false },
  { stage: "qualified", label: "Qualified", position: 2, hidden: false },
  { stage: "proposal", label: "Estimate", position: 3, hidden: false },
  { stage: "negotiation", label: "Booked", position: 4, hidden: false },
  { stage: "won", label: "Won", position: 5, hidden: false },
  { stage: "lost", label: "Lost", position: 6, hidden: false },
];

export const assignmentModes: { id: AssignmentMode; label: string; description: string }[] = [
  {
    id: "manual",
    label: "Manual",
    description: "New leads stay unassigned until someone chooses an owner.",
  },
  {
    id: "round_robin",
    label: "Round-robin",
    description: "Leads created without an owner rotate through members who can own leads.",
  },
  {
    id: "fixed",
    label: "Fixed owner",
    description: "Leads created without an owner go to one person.",
  },
];

export function isLeadStage(value: string): value is LeadStage {
  return (leadStages as readonly string[]).includes(value);
}

export function phoneDigits(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
}

export function leadTitle(lead: { company?: string | null; contact_name?: string | null }) {
  const company = lead.company?.trim();
  if (company) return company;
  const name = lead.contact_name?.trim();
  return name || "Lead";
}

export function stageLabel(stages: PipelineStageView[], stage: LeadStage) {
  return stages.find((s) => s.stage === stage)?.label ?? stage;
}

export function visibleStages(stages: PipelineStageView[], counts?: Partial<Record<LeadStage, number>>) {
  return [...stages]
    .sort((a, b) => a.position - b.position || leadStages.indexOf(a.stage) - leadStages.indexOf(b.stage))
    .filter((s) => !s.hidden || (counts?.[s.stage] ?? 0) > 0);
}

/** UTC month key stored on organization_ai_usage, YYYY-MM-01. */
export function usageMonth(now = new Date()) {
  return `${now.toISOString().slice(0, 7)}-01`;
}

export const AI_SUGGESTION_CAP = 50;
