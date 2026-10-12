"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { KeyRound, ShieldAlert, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { CopyButton, Field, FormAlert, SubmitButton } from "@/components/portal/forms";
import { Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import {
  confirmTotpEnrollment,
  removeTotpFactor,
  setStaffMfaRequirement,
  startTotpEnrollment,
  type EnrollState,
} from "@/lib/portal/actions/security";
import { formatDate } from "@/lib/portal/format";

export type FactorView = { id: string; name: string; createdAt: string };

export function SecuritySettings({
  factors,
  requiredBy,
  staffSetting,
}: {
  factors: FactorView[];
  /** Who requires MFA for this account, if anyone, e.g. "Largis" or "Acme Retail". */
  requiredBy: string | null;
  /** Staff admins manage the team-wide requirement here. */
  staffSetting?: { requireStaffMfa: boolean };
}) {
  const enabled = factors.length > 0;

  return (
    <div className="space-y-6">
      {requiredBy && !enabled && (
        <div role="alert" className="flex items-start gap-3 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {requiredBy} requires two-step verification for your account. Add an authenticator app below to continue using the
            portal.
          </p>
        </div>
      )}

      <Panel
        title="Two-step verification"
        actions={enabled ? <Badge tone="success">On</Badge> : <Badge tone={requiredBy ? "warning" : "neutral"}>Off</Badge>}
        bodyClassName="p-4 sm:p-5"
      >
        <p className="text-sm leading-relaxed text-ink-muted">
          After the emailed sign-in code, you&apos;ll also enter a 6-digit code from an authenticator app such as Google Authenticator,
          Microsoft Authenticator, 1Password, or Authy. Someone with access to your inbox alone can no longer sign in as you.
        </p>

        {enabled && (
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {factors.map((f) => (
              <FactorRow key={f.id} factor={f} />
            ))}
          </ul>
        )}

        <div className="mt-5">
          <EnrollFlow hasFactors={enabled} />
        </div>
      </Panel>

      {staffSetting && <StaffRequirementForm requireStaffMfa={staffSetting.requireStaffMfa} />}
    </div>
  );
}

function FactorRow({ factor }: { factor: FactorView }) {
  const [state, action] = useFormState(removeTotpFactor, idleState);
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-line text-ink-subtle">
            <Smartphone className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{factor.name}</span>
            <span className="block text-xs text-ink-subtle">Added {formatDate(factor.createdAt)}</span>
          </span>
        </div>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="factorId" value={factor.id} />
          {confirming ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Keep
              </Button>
              <SubmitButton size="sm" className="bg-red-700 hover:bg-red-800" pendingLabel="Removing…">
                Remove
              </SubmitButton>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove<span className="sr-only"> {factor.name}</span>
            </button>
          )}
        </form>
      </div>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {state.message}
        </p>
      )}
    </li>
  );
}

/** Supabase returns the QR code as an SVG data URL; anything else is not rendered. */
function isSvgDataUrl(value: string) {
  return value.startsWith("data:image/svg+xml");
}

function EnrollFlow({ hasFactors }: { hasFactors: boolean }) {
  const [round, setRound] = useState(0);
  const [started, setStarted] = useState(false);
  const [flash, setFlash] = useState<ActionState>(idleState);

  if (!started) {
    return (
      <div className="space-y-4">
        <FormAlert state={flash} onDismiss={() => setFlash(idleState)} />
        <Button
          size="sm"
          variant={hasFactors ? "outline" : "primary"}
          onClick={() => {
            setFlash(idleState);
            setRound((r) => r + 1);
            setStarted(true);
          }}
        >
          <KeyRound className="h-4 w-4" />
          {hasFactors ? "Add another authenticator" : "Set up an authenticator app"}
        </Button>
      </div>
    );
  }

  return (
    <EnrollSteps
      key={round}
      onCancel={() => setStarted(false)}
      onDone={(state) => {
        setFlash(state);
        setStarted(false);
      }}
    />
  );
}

function EnrollSteps({ onCancel, onDone }: { onCancel: () => void; onDone: (state: ActionState) => void }) {
  const [startState, startAction] = useFormState<EnrollState, FormData>(startTotpEnrollment, idleState);
  const [confirmState, confirmAction] = useFormState(confirmTotpEnrollment, idleState);
  useEffect(() => {
    if (confirmState.status === "success") onDone(confirmState);
  }, [confirmState, onDone]);

  const enrollment = startState.enrollment;

  if (!enrollment) {
    return (
      <form action={startAction} noValidate className="space-y-4 border border-line bg-paper-soft/50 p-4">
        <FormAlert state={startState} />
        <Field
          name="friendlyName"
          label="Name this device"
          placeholder="e.g. Work phone"
          maxLength={60}
          errors={startState.fieldErrors}
          hint="Helps you tell authenticators apart if you add more than one."
          autoFocus
        />
        <div className="flex flex-wrap gap-3">
          <SubmitButton size="sm" pendingLabel="Preparing…">
            Continue
          </SubmitButton>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form action={confirmAction} noValidate className="space-y-5 border border-line bg-paper-soft/50 p-4">
      <FormAlert state={confirmState} />
      <input type="hidden" name="factorId" value={enrollment.factorId} />
      <ol className="space-y-5 text-sm">
        <li>
          <p className="font-medium">1. Scan this code with your authenticator app</p>
          {isSvgDataUrl(enrollment.qrCode) ? (
            <Image
              src={enrollment.qrCode}
              alt="QR code for setting up your authenticator app"
              width={176}
              height={176}
              unoptimized
              className="mt-3 border border-line bg-white p-2"
            />
          ) : (
            <p className="mt-2 text-ink-muted">The QR code could not be displayed. Enter the setup key below instead.</p>
          )}
        </li>
        <li>
          <p className="font-medium">Or enter this setup key manually</p>
          <div className="mt-2 flex min-w-0 items-center gap-3 border border-line bg-white px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-xs">{enrollment.secret}</code>
            <CopyButton value={enrollment.secret} label="Copy key" />
          </div>
        </li>
        <li>
          <p className="mb-2 font-medium">2. Enter the 6-digit code the app shows</p>
          <Field
            name="code"
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="123456"
            className="max-w-[12rem] font-mono tracking-[0.2em]"
            errors={confirmState.fieldErrors}
            autoFocus
          />
        </li>
      </ol>
      <div className="flex flex-wrap gap-3">
        <SubmitButton size="sm" pendingLabel="Verifying…">
          Turn on two-step verification
        </SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function StaffRequirementForm({ requireStaffMfa }: { requireStaffMfa: boolean }) {
  const [state, action] = useFormState(setStaffMfaRequirement, idleState);
  return (
    <Panel title="Staff policy" actions={<ShieldCheck className="h-4 w-4 text-ink-subtle" />} bodyClassName="p-4 sm:p-5">
      <form action={action} className="space-y-4">
        <FormAlert state={state} />
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="requireStaffMfa"
            defaultChecked={requireStaffMfa}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span>
            Require two-step verification for all staff
            <span className="block text-xs text-ink-subtle">
              Staff without an authenticator app are sent to this page until they add one. Anyone who has one must enter a code at
              every sign-in, whatever this setting.
            </span>
          </span>
        </label>
        <SubmitButton size="sm" pendingLabel="Saving…">
          Save policy
        </SubmitButton>
      </form>
    </Panel>
  );
}
