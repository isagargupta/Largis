"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { Download, EyeOff, Lock, Pencil, Plus, Search, Settings, ShieldCheck, Trash2, X } from "lucide-react";
import { Field, FormAlert, Modal, SelectBox, SelectField, SubmitButton, compactControl } from "@/components/portal/forms";
import { ImportLeads } from "@/components/portal/ImportLeads";
import { EmptyState } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import { createLead, deleteLead, updateLead } from "@/lib/portal/actions/leads";
import { formatCents, formatDateTime } from "@/lib/portal/format";
import { leadSources, stageMeta, type RolePermissions } from "@/lib/portal/meta";
import { leadTitle, visibleStages, type PipelineStageView } from "@/lib/revenue/stages";
import type { LeadStage } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export type LeadRow = {
  id: string;
  company: string | null;
  contact_name: string;
  contact_email: string | null;
  phone: string | null;
  service_address: string | null;
  job_type: string | null;
  lost_reason: string | null;
  stage: LeadStage;
  /** Null when the database withholds deal values from the viewer's role. */
  value_cents: number | null;
  owner_id: string | null;
  source: string | null;
  notes: string | null;
  updated_at: string;
};

export type MemberOption = { id: string; name: string };

type Editing = { mode: "create" } | { mode: "edit"; lead: LeadRow } | null;
type Queue = "all" | "mine" | "unassigned" | "overdue";

const sourceSuggestions = [...leadSources, "Phone", "Web form", "Google", "Angi"];

function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function LeadsManager({
  organizationId,
  exportName,
  leads,
  members,
  perms,
  currentUserId,
  stages,
  overdueLeadIds = [],
  leadBase,
  canImport = false,
  settingsHref,
  initialStage = "all",
}: {
  organizationId: string;
  exportName: string;
  leads: LeadRow[];
  members: MemberOption[];
  perms: RolePermissions;
  currentUserId: string;
  stages: PipelineStageView[];
  overdueLeadIds?: string[];
  leadBase: string;
  canImport?: boolean;
  settingsHref?: string;
  initialStage?: LeadStage | "all";
}) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<LeadStage | "all">(initialStage);
  const [queue, setQueue] = useState<Queue>("all");
  const [source, setSource] = useState("all");
  const [editing, setEditing] = useState<Editing>(null);
  const [flash, setFlash] = useState<ActionState>(idleState);

  const ownerName = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const stageNames = useMemo(() => new Map(stages.map((item) => [item.stage, item.label])), [stages]);
  const labelFor = useCallback((value: LeadStage) => stageNames.get(value) ?? stageMeta[value].label, [stageNames]);
  const overdue = useMemo(() => new Set(overdueLeadIds), [overdueLeadIds]);
  const sources = useMemo(
    () => Array.from(new Set([...leadSources, ...leads.map((l) => l.source).filter((s): s is string => Boolean(s))])),
    [leads],
  );

  const counts = useMemo(() => {
    const c = {} as Record<LeadStage, number>;
    leads.forEach((l) => {
      c[l.stage] = (c[l.stage] ?? 0) + 1;
    });
    return c;
  }, [leads]);
  const tabs = useMemo(() => visibleStages(stages, counts), [stages, counts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (stage !== "all" && l.stage !== stage) return false;
      if (source !== "all" && l.source !== source) return false;
      if (queue === "mine" && l.owner_id !== currentUserId) return false;
      if (queue === "unassigned" && l.owner_id) return false;
      if (queue === "overdue" && !overdue.has(l.id)) return false;
      if (!q) return true;
      return [leadTitle(l), l.contact_name, l.contact_email ?? "", l.phone ?? "", l.company ?? ""].some((value) =>
        value.toLowerCase().includes(q),
      );
    });
  }, [leads, query, stage, source, queue, currentUserId, overdue]);

  const hasFilters = query !== "" || stage !== "all" || source !== "all" || queue !== "all";

  function resetFilters() {
    setQuery("");
    setStage("all");
    setSource("all");
    setQueue("all");
  }

  function canEditLead(lead: LeadRow) {
    return perms.canEdit && (!perms.ownOnly || lead.owner_id === currentUserId);
  }

  function exportCsv() {
    const header = [
      "Company",
      "Contact",
      "Email",
      "Phone",
      "Stage",
      ...(perms.canViewValue ? ["Value (USD)"] : []),
      "Owner",
      "Source",
      "Job",
      "Address",
      "Notes",
      "Updated (UTC)",
    ];
    const lines = filtered.map((l) =>
      [
        l.company ?? "",
        l.contact_name,
        l.contact_email ?? "",
        l.phone ?? "",
        labelFor(l.stage),
        ...(perms.canViewValue ? [((l.value_cents ?? 0) / 100).toFixed(2)] : []),
        l.owner_id ? ownerName.get(l.owner_id) ?? "" : "",
        l.source ?? "",
        l.job_type ?? "",
        l.service_address ?? "",
        l.notes ?? "",
        l.updated_at,
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName}-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const done = useCallback((message: string) => {
    setEditing(null);
    setFlash({ status: "success", message });
  }, []);

  const queues: { id: Queue; label: string }[] = [
    { id: "all", label: "All" },
    { id: "mine", label: "Mine" },
    { id: "unassigned", label: "Unassigned" },
    { id: "overdue", label: overdueLeadIds.length ? `Overdue (${overdueLeadIds.length})` : "Overdue" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {perms.canEdit && (
          <Button size="sm" onClick={() => setEditing({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            Add lead
          </Button>
        )}
        {canImport && <ImportLeads organizationId={organizationId} />}
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        {settingsHref && (
          <ButtonLink href={settingsHref} variant="outline" size="sm">
            <Settings className="h-4 w-4" />
            Pipeline settings
          </ButtonLink>
        )}
        <span className="text-xs text-ink-subtle">Exports the {filtered.length} rows currently shown.</span>
      </div>

      <FormAlert state={flash} onDismiss={() => setFlash(idleState)} />

      <div className="flex flex-wrap gap-2">
        {queues.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setQueue(item.id)}
            aria-pressed={queue === item.id}
            className={cn(
              "border px-3 py-1.5 text-sm",
              queue === item.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="border border-line bg-white p-4 sm:p-5">
        <p className="text-sm text-ink-subtle">Pipeline status</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.stage}
              type="button"
              onClick={() => setStage(stage === item.stage ? "all" : item.stage)}
              aria-pressed={stage === item.stage}
              className={cn("rounded-full transition-opacity", stage !== "all" && stage !== item.stage && "opacity-40 hover:opacity-80")}
            >
              <Badge tone={stageMeta[item.stage].tone}>
                {item.label}
                <span className="tabular-nums opacity-70">{counts[item.stage] ?? 0}</span>
              </Badge>
            </button>
          ))}
        </div>
      </div>

      <div className="border border-line bg-white">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company, phone, or email"
              aria-label="Search leads"
              className={cn(compactControl, "w-full pl-9 placeholder:text-ink-subtle")}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 md:w-40 md:flex-none">
              <SelectBox compact value={stage} onChange={(e) => setStage(e.target.value as LeadStage | "all")} aria-label="Filter by stage">
                <option value="all">All stages</option>
                {tabs.map((item) => (
                  <option key={item.stage} value={item.stage}>
                    {item.label}
                  </option>
                ))}
              </SelectBox>
            </div>
            <div className="flex-1 md:w-40 md:flex-none">
              <SelectBox compact value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
                <option value="all">All sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectBox>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                aria-label="Clear filters"
                className="grid w-10 shrink-0 place-items-center text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {perms.ownOnly && (
          <div className="flex items-center gap-2 border-b border-line bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            <EyeOff className="h-4 w-4 shrink-0" />
            Agent view: only leads assigned to you are shown, and deal values are hidden.
          </div>
        )}

        {leads.length === 0 ? (
          <EmptyState title="No leads yet">
            {perms.canEdit ? "Add your first lead to start tracking the pipeline." : "Leads added by your team will appear here."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-paper-soft">
                <tr className="border-b border-line text-ink-subtle">
                  <th scope="col" className="px-4 py-3 font-normal">
                    Lead
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    Stage
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">
                    Value
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    Owner
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    Source
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    Updated
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((lead) => {
                  const editable = canEditLead(lead);
                  const title = leadTitle(lead);
                  const detail = [lead.company ? lead.contact_name : null, lead.phone, lead.contact_email].filter(Boolean).join(" · ");
                  return (
                    <tr key={lead.id} className="transition-colors hover:bg-paper-soft/70">
                      <td className="px-4 py-3">
                        <Link href={`${leadBase}/${lead.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                          {title}
                        </Link>
                        {detail && <p className="text-xs text-ink-subtle">{detail}</p>}
                        {overdue.has(lead.id) && <p className="mt-1 text-xs text-red-700">Follow-up overdue</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={stageMeta[lead.stage].tone}>{labelFor(lead.stage)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {perms.canViewValue && lead.value_cents !== null ? (
                          formatCents(lead.value_cents)
                        ) : (
                          <span className="text-ink-subtle">Hidden</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.owner_id ? (
                          ownerName.get(lead.owner_id) ?? "Former member"
                        ) : (
                          <span className="text-ink-subtle">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{lead.source ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-subtle">{formatDateTime(lead.updated_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditing({ mode: "edit", lead })}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
                        >
                          {editable ? <Pencil className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                          {editable ? "Edit" : "View"}
                          <span className="sr-only"> {title}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-subtle">
                      No leads match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-ink-subtle">
          <span>
            Showing {filtered.length} of {leads.length} leads you can access
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Limited to this organisation by row level security
          </span>
        </div>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === "edit" ? leadTitle(editing.lead) : "Add lead"}
        description={editing?.mode === "edit" && !canEditLead(editing.lead) ? "Read only for your role." : undefined}
      >
        {editing && (
          <LeadForm
            key={editing.mode === "edit" ? editing.lead.id : "new"}
            organizationId={organizationId}
            lead={editing.mode === "edit" ? editing.lead : null}
            members={members}
            stages={stages}
            perms={perms}
            leadBase={leadBase}
            readOnly={editing.mode === "edit" && !canEditLead(editing.lead)}
            onDone={done}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

export function LeadForm({
  organizationId,
  lead,
  members,
  stages,
  perms,
  leadBase,
  readOnly,
  onDone,
  onCancel,
}: {
  organizationId: string;
  lead: LeadRow | null;
  members: MemberOption[];
  stages: PipelineStageView[];
  perms: RolePermissions;
  leadBase?: string;
  readOnly: boolean;
  onDone?: (message: string) => void;
  onCancel?: () => void;
}) {
  const [state, action] = useFormState(lead ? updateLead : createLead, idleState);
  const errors = state.fieldErrors;
  const choices = visibleStages(stages);
  const current = lead ? stages.find((item) => item.stage === lead.stage) : undefined;
  const stageOptions = current && !choices.some((item) => item.stage === current.stage) ? [...choices, current] : choices;

  useEffect(() => {
    if (state.status === "success") onDone?.(state.message ?? "Saved.");
  }, [state, onDone]);

  return (
    <div className="space-y-6">
      <form action={action} noValidate className="space-y-5">
        <FormAlert state={state} />
        {state.status === "error" && state.id && leadBase && (
          <Link href={`${leadBase}/${state.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Open the existing lead
          </Link>
        )}
        <input type="hidden" name="organizationId" value={organizationId} />
        {lead && <input type="hidden" name="id" value={lead.id} />}
        <fieldset disabled={readOnly} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="contactName" label="Contact name" errors={errors} defaultValue={lead?.contact_name} required autoFocus />
            <Field name="company" label="Company" errors={errors} defaultValue={lead?.company ?? ""} hint="Optional for a homeowner." />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="phone" label="Phone" errors={errors} defaultValue={lead?.phone ?? ""} />
            <Field name="contactEmail" label="Contact email" type="email" errors={errors} defaultValue={lead?.contact_email ?? ""} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="serviceAddress" label="Service address" errors={errors} defaultValue={lead?.service_address ?? ""} />
            <Field name="jobType" label="Job type" list="job-types" errors={errors} defaultValue={lead?.job_type ?? ""} />
            <datalist id="job-types">
              {["Plumbing", "HVAC", "Cleaning", "Roofing", "Electrical"].map((job) => (
                <option key={job} value={job} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField name="stage" label="Stage" errors={errors} defaultValue={lead?.stage ?? "new"}>
              {stageOptions.map((item) => (
                <option key={item.stage} value={item.stage}>
                  {item.label}
                </option>
              ))}
            </SelectField>
            {perms.canViewValue && (
              <Field
                name="value"
                label="Deal value (USD)"
                inputMode="decimal"
                errors={errors}
                defaultValue={lead?.value_cents ? String(lead.value_cents / 100) : ""}
                placeholder="25000"
              />
            )}
            {perms.canAssign ? (
              <SelectField name="ownerId" label="Owner" errors={errors} defaultValue={lead?.owner_id ?? ""}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </SelectField>
            ) : (
              <input type="hidden" name="ownerId" value="" />
            )}
            <Field name="source" label="Source" list="lead-sources" errors={errors} defaultValue={lead?.source ?? ""} />
            <datalist id="lead-sources">
              {sourceSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <Field name="lostReason" label="Lost reason" errors={errors} defaultValue={lead?.lost_reason ?? ""} />
          <div>
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea id="lead-notes" name="notes" defaultValue={lead?.notes ?? ""} className="min-h-[110px]" />
            {errors?.notes && <p className="mt-1.5 text-sm text-red-700">{errors.notes}</p>}
          </div>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-3">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
          )}
          {!readOnly && <SubmitButton pendingLabel="Saving…">{lead ? "Save changes" : "Add lead"}</SubmitButton>}
        </div>
      </form>

      {lead && perms.canDelete && <DeleteLead organizationId={organizationId} lead={lead} onDone={onDone} />}
    </div>
  );
}

function DeleteLead({
  organizationId,
  lead,
  onDone,
}: {
  organizationId: string;
  lead: LeadRow;
  onDone?: (message: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useFormState(deleteLead, idleState);
  const title = leadTitle(lead);

  useEffect(() => {
    if (state.status === "success") onDone?.(state.message ?? "Deleted.");
  }, [state, onDone]);

  return (
    <form action={action} className="border-t border-line pt-5">
      <input type="hidden" name="id" value={lead.id} />
      <input type="hidden" name="organizationId" value={organizationId} />
      {state.status === "error" && <FormAlert state={state} />}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-red-800">Delete {title}? This can&apos;t be undone.</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <SubmitButton size="sm" className="bg-red-700 hover:bg-red-800" pendingLabel="Deleting…">
            Delete lead
          </SubmitButton>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800"
        >
          <Trash2 className="h-4 w-4" />
          Delete this lead
        </button>
      )}
    </form>
  );
}
