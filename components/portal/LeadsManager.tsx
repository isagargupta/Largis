"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { Download, EyeOff, Lock, Pencil, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { Field, FormAlert, Modal, SelectBox, SelectField, SubmitButton, compactControl } from "@/components/portal/forms";
import { EmptyState } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import { createLead, deleteLead, updateLead } from "@/lib/portal/actions/leads";
import { formatCents, formatDateTime } from "@/lib/portal/format";
import { leadSources, stageMeta, stageOrder, type RolePermissions } from "@/lib/portal/meta";
import type { LeadStage } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export type LeadRow = {
  id: string;
  company: string;
  contact_name: string;
  contact_email: string | null;
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
  initialStage = "all",
}: {
  organizationId: string;
  exportName: string;
  leads: LeadRow[];
  members: MemberOption[];
  perms: RolePermissions;
  currentUserId: string;
  initialStage?: LeadStage | "all";
}) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<LeadStage | "all">(initialStage);
  const [source, setSource] = useState("all");
  const [editing, setEditing] = useState<Editing>(null);
  const [flash, setFlash] = useState<ActionState>(idleState);

  const ownerName = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const sources = useMemo(
    () => Array.from(new Set([...leadSources, ...leads.map((l) => l.source).filter((s): s is string => Boolean(s))])),
    [leads],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (stage === "all" || l.stage === stage) &&
        (source === "all" || l.source === source) &&
        (!q ||
          l.company.toLowerCase().includes(q) ||
          l.contact_name.toLowerCase().includes(q) ||
          (l.contact_email ?? "").includes(q)),
    );
  }, [leads, query, stage, source]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(stageOrder.map((s) => [s, 0])) as Record<LeadStage, number>;
    leads.forEach((l) => c[l.stage]++);
    return c;
  }, [leads]);

  const hasFilters = query !== "" || stage !== "all" || source !== "all";

  function resetFilters() {
    setQuery("");
    setStage("all");
    setSource("all");
  }

  function canEditLead(lead: LeadRow) {
    return perms.canEdit && (!perms.ownOnly || lead.owner_id === currentUserId);
  }

  function exportCsv() {
    const header = ["Company", "Contact", "Email", "Stage", ...(perms.canViewValue ? ["Value (USD)"] : []), "Owner", "Source", "Notes", "Updated (UTC)"];
    const lines = filtered.map((l) =>
      [
        l.company,
        l.contact_name,
        l.contact_email ?? "",
        stageMeta[l.stage].label,
        ...(perms.canViewValue ? [((l.value_cents ?? 0) / 100).toFixed(2)] : []),
        l.owner_id ? ownerName.get(l.owner_id) ?? "" : "",
        l.source ?? "",
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {perms.canEdit && (
          <Button size="sm" onClick={() => setEditing({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            Add lead
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <span className="text-xs text-ink-subtle">Exports the {filtered.length} rows currently shown.</span>
      </div>

      <FormAlert state={flash} onDismiss={() => setFlash(idleState)} />

      <div className="border border-line bg-white p-4 sm:p-5">
        <p className="text-sm text-ink-subtle">Pipeline status</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {stageOrder.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(stage === s ? "all" : s)}
              aria-pressed={stage === s}
              className={cn("rounded-full transition-opacity", stage !== "all" && stage !== s && "opacity-40 hover:opacity-80")}
            >
              <Badge tone={stageMeta[s].tone}>
                {stageMeta[s].label}
                <span className="tabular-nums opacity-70">{counts[s]}</span>
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
              placeholder="Search company, contact, or email"
              aria-label="Search leads"
              className={cn(compactControl, "w-full pl-9 placeholder:text-ink-subtle")}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 md:w-40 md:flex-none">
              <SelectBox compact value={stage} onChange={(e) => setStage(e.target.value as LeadStage | "all")} aria-label="Filter by stage">
                <option value="all">All stages</option>
                {stageOrder.map((s) => (
                  <option key={s} value={s}>
                    {stageMeta[s].label}
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
                  <th scope="col" className="px-4 py-3 font-normal">Company</th>
                  <th scope="col" className="px-4 py-3 font-normal">Stage</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Value</th>
                  <th scope="col" className="px-4 py-3 font-normal">Owner</th>
                  <th scope="col" className="px-4 py-3 font-normal">Source</th>
                  <th scope="col" className="px-4 py-3 font-normal">Updated</th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((lead) => {
                  const editable = canEditLead(lead);
                  return (
                    <tr key={lead.id} className="transition-colors hover:bg-paper-soft/70">
                      <td className="px-4 py-3">
                        <p>{lead.company}</p>
                        <p className="text-xs text-ink-subtle">
                          {lead.contact_name}
                          {lead.contact_email && <> · {lead.contact_email}</>}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={stageMeta[lead.stage].tone}>{stageMeta[lead.stage].label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {perms.canViewValue && lead.value_cents !== null ? (
                          formatCents(lead.value_cents)
                        ) : (
                          <span className="text-ink-subtle">Hidden</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead.owner_id ? ownerName.get(lead.owner_id) ?? "Former member" : <span className="text-ink-subtle">Unassigned</span>}
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
                          <span className="sr-only"> {lead.company}</span>
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
        title={editing?.mode === "edit" ? editing.lead.company : "Add lead"}
        description={editing?.mode === "edit" && !canEditLead(editing.lead) ? "Read only for your role." : undefined}
      >
        {editing && (
          <LeadForm
            key={editing.mode === "edit" ? editing.lead.id : "new"}
            organizationId={organizationId}
            lead={editing.mode === "edit" ? editing.lead : null}
            members={members}
            perms={perms}
            readOnly={editing.mode === "edit" && !canEditLead(editing.lead)}
            onDone={done}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function LeadForm({
  organizationId,
  lead,
  members,
  perms,
  readOnly,
  onDone,
  onCancel,
}: {
  organizationId: string;
  lead: LeadRow | null;
  members: MemberOption[];
  perms: RolePermissions;
  readOnly: boolean;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, action] = useFormState(lead ? updateLead : createLead, idleState);
  const errors = state.fieldErrors;

  useEffect(() => {
    if (state.status === "success") onDone(state.message ?? "Saved.");
  }, [state, onDone]);

  return (
    <div className="space-y-6">
      <form action={action} noValidate className="space-y-5">
        <FormAlert state={state} />
        <input type="hidden" name="organizationId" value={organizationId} />
        {lead && <input type="hidden" name="id" value={lead.id} />}
        <fieldset disabled={readOnly} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="company" label="Company" errors={errors} defaultValue={lead?.company} required autoFocus />
            <Field name="contactName" label="Contact name" errors={errors} defaultValue={lead?.contact_name} required />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="contactEmail" label="Contact email" type="email" errors={errors} defaultValue={lead?.contact_email ?? ""} />
            <SelectField name="stage" label="Stage" errors={errors} defaultValue={lead?.stage ?? "new"}>
              {stageOrder.map((s) => (
                <option key={s} value={s}>
                  {stageMeta[s].label}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
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
              {leadSources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea id="lead-notes" name="notes" defaultValue={lead?.notes ?? ""} className="min-h-[110px]" />
            {errors?.notes && <p className="mt-1.5 text-sm text-red-700">{errors.notes}</p>}
          </div>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && <SubmitButton pendingLabel="Saving…">{lead ? "Save changes" : "Add lead"}</SubmitButton>}
        </div>
      </form>

      {lead && perms.canDelete && <DeleteLead organizationId={organizationId} lead={lead} onDone={onDone} />}
    </div>
  );
}

function DeleteLead({ organizationId, lead, onDone }: { organizationId: string; lead: LeadRow; onDone: (m: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useFormState(deleteLead, idleState);

  useEffect(() => {
    if (state.status === "success") onDone(state.message ?? "Deleted.");
  }, [state, onDone]);

  return (
    <form action={action} className="border-t border-line pt-5">
      <input type="hidden" name="id" value={lead.id} />
      <input type="hidden" name="organizationId" value={organizationId} />
      {state.status === "error" && <FormAlert state={state} />}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-red-800">Delete {lead.company}? This can&apos;t be undone.</p>
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
