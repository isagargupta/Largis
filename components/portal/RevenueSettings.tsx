"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { FormAlert, SelectField, SubmitButton } from "@/components/portal/forms";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/portal/action-state";
import { applyHomeServicePreset, saveAssignment, savePipeline } from "@/lib/portal/actions/revenue";
import { assignmentModes, lockedStages, type PipelineStageView } from "@/lib/revenue/stages";
import type { AssignmentMode } from "@/lib/supabase/types";
import type { MemberOption } from "@/components/portal/LeadsManager";

export function RevenueSettings({
  organizationId,
  stages,
  mode,
  fixedOwnerId,
  members,
}: {
  organizationId: string;
  stages: PipelineStageView[];
  mode: AssignmentMode;
  fixedOwnerId: string | null;
  members: MemberOption[];
}) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const [pipelineState, pipelineAction] = useFormState(savePipeline, idleState);
  const [presetState, presetAction] = useFormState(applyHomeServicePreset, idleState);
  const [assignmentState, assignmentAction] = useFormState(saveAssignment, idleState);
  const [assignmentMode, setAssignmentMode] = useState(mode);

  useEffect(() => setAssignmentMode(mode), [mode]);

  return (
    <div className="space-y-6">
      <form action={presetAction} className="border border-line bg-white p-4 sm:p-5">
        <input type="hidden" name="organizationId" value={organizationId} />
        <h2 className="text-[15px] font-semibold">Home-service pipeline</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Applies New, Contacted, Qualified, Estimate, Booked, Won, and Lost. Existing leads stay on the same stage values, with the
          new labels. You can change the labels again afterwards.
        </p>
        <FormAlert state={presetState} />
        <div className="mt-4">
          <SubmitButton size="sm" variant="outline" pendingLabel="Applying…">
            Apply home-service preset
          </SubmitButton>
        </div>
      </form>

      <form action={pipelineAction} className="border border-line bg-white">
        <input type="hidden" name="organizationId" value={organizationId} />
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-[15px] font-semibold">Stage labels</h2>
          <p className="mt-1 text-sm text-ink-muted">New, Won, and Lost stay visible. Contacted starts hidden until you show it.</p>
        </div>
        <div className="divide-y divide-line">
          {ordered.map((stage) => {
            const locked = lockedStages.includes(stage.stage);
            return (
              <div key={stage.stage} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:items-center sm:px-5">
                <label className="block text-sm">
                  <span className="text-xs text-ink-subtle">Label</span>
                  <input
                    name={`label.${stage.stage}`}
                    defaultValue={stage.label}
                    required
                    maxLength={40}
                    className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-ink-subtle">Position</span>
                  <input
                    name={`position.${stage.stage}`}
                    type="number"
                    min={0}
                    max={20}
                    defaultValue={stage.position}
                    required
                    className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm sm:mt-5">
                  <input
                    type="checkbox"
                    name={`hidden.${stage.stage}`}
                    defaultChecked={stage.hidden}
                    disabled={locked}
                  />
                  Hide
                </label>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
          <FormAlert state={pipelineState} />
          <SubmitButton size="sm" pendingLabel="Saving…">
            Save pipeline
          </SubmitButton>
        </div>
      </form>

      <form action={assignmentAction} className="space-y-5 border border-line bg-white p-4 sm:p-5">
        <input type="hidden" name="organizationId" value={organizationId} />
        <div>
          <h2 className="text-[15px] font-semibold">Assignment</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Used when a manager adds a lead without choosing an owner. Agents who add a lead still own it.
          </p>
        </div>
        <fieldset className="space-y-3">
          {assignmentModes.map((option) => (
            <label key={option.id} className="flex gap-3 text-sm">
              <input
                type="radio"
                name="mode"
                value={option.id}
                checked={assignmentMode === option.id}
                onChange={() => setAssignmentMode(option.id)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="mt-0.5 block text-ink-muted">{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {assignmentMode === "fixed" && (
          <SelectField name="fixedOwnerId" label="Owner" errors={assignmentState.fieldErrors} defaultValue={fixedOwnerId ?? ""}>
            <option value="">Choose a member</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </SelectField>
        )}
        <FormAlert state={assignmentState} />
        <div className="flex justify-end">
          <SubmitButton size="sm" pendingLabel="Saving…">
            Save assignment
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
