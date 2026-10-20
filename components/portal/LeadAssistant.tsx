"use client";

import { useFormState } from "react-dom";
import { FormAlert, SubmitButton } from "@/components/portal/forms";
import { Badge } from "@/components/ui/badge";
import { idleState } from "@/lib/portal/action-state";
import { approveSuggestion, dismissSuggestion, requestSuggestion } from "@/lib/portal/actions/revenue";
import type { SuggestionKind, SuggestionStatus } from "@/lib/supabase/types";

export type SuggestionRow = {
  id: string;
  kind: SuggestionKind;
  body: string;
  status: SuggestionStatus;
  created_at: string;
};

const kinds: { id: SuggestionKind; label: string; pending: string }[] = [
  { id: "summary", label: "Summarize", pending: "Summarizing…" },
  { id: "reply", label: "Draft reply", pending: "Drafting…" },
  { id: "next_action", label: "Suggest next action", pending: "Suggesting…" },
];

const kindLabel: Record<SuggestionKind, string> = {
  summary: "Summary",
  reply: "Reply draft",
  next_action: "Next action",
};

export function LeadAssistant({
  organizationId,
  leadId,
  suggestions,
  used,
  cap,
  configured,
  canEdit,
}: {
  organizationId: string;
  leadId: string;
  suggestions: SuggestionRow[];
  used: number;
  cap: number;
  configured: boolean;
  canEdit: boolean;
}) {
  const visible = suggestions.filter((suggestion) => suggestion.status !== "dismissed");

  return (
    <section className="border border-line bg-white">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-semibold">Sales assistant</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Drafts stay here until someone approves them. Nothing is sent to the customer.
          {canEdit ? ` ${used} of ${cap} suggestions used this month.` : ""}
        </p>
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3 sm:px-5">
          {configured ? (
            kinds.map((kind) => (
              <DraftButton key={kind.id} organizationId={organizationId} leadId={leadId} kind={kind} disabled={used >= cap} />
            ))
          ) : (
            <p className="text-sm text-ink-subtle">The sales assistant isn&apos;t configured yet.</p>
          )}
        </div>
      )}
      {visible.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-subtle sm:px-5">No drafts yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((suggestion) => (
            <li key={suggestion.id} className="space-y-3 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={suggestion.status === "approved" ? "success" : "neutral"}>{kindLabel[suggestion.kind]}</Badge>
                <span className="text-xs text-ink-subtle">{suggestion.status === "approved" ? "Approved" : "Waiting for approval"}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{suggestion.body}</p>
              {suggestion.status === "approved" && suggestion.kind !== "next_action" && (
                <p className="text-xs text-ink-subtle">Saved on this lead. Nothing was sent.</p>
              )}
              {suggestion.status === "approved" && suggestion.kind === "next_action" && (
                <p className="text-xs text-ink-subtle">Added as a follow-up due in one day.</p>
              )}
              {canEdit && suggestion.status === "pending" && (
                <Decision organizationId={organizationId} leadId={leadId} suggestionId={suggestion.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DraftButton({
  organizationId,
  leadId,
  kind,
  disabled,
}: {
  organizationId: string;
  leadId: string;
  kind: (typeof kinds)[number];
  disabled: boolean;
}) {
  const [state, action] = useFormState(requestSuggestion, idleState);
  return (
    <form action={action}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="kind" value={kind.id} />
      {state.status === "error" && (
        <div className="mb-2">
          <FormAlert state={state} />
        </div>
      )}
      <SubmitButton size="sm" variant="outline" pendingLabel={kind.pending} disabled={disabled}>
        {kind.label}
      </SubmitButton>
    </form>
  );
}

function Decision({ organizationId, leadId, suggestionId }: { organizationId: string; leadId: string; suggestionId: string }) {
  const [approveState, approve] = useFormState(approveSuggestion, idleState);
  const [dismissState, dismiss] = useFormState(dismissSuggestion, idleState);
  return (
    <div className="space-y-2">
      <FormAlert state={approveState.status === "idle" ? dismissState : approveState} />
      <div className="flex flex-wrap gap-2">
        <form action={approve}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="id" value={suggestionId} />
          <SubmitButton size="sm" pendingLabel="Approving…">
            Approve
          </SubmitButton>
        </form>
        <form action={dismiss}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="id" value={suggestionId} />
          <SubmitButton size="sm" variant="outline" pendingLabel="Dismissing…">
            Dismiss
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
