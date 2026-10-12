"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, CheckCircle2, ChevronDown, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { compactControl } from "@/components/portal/control-styles";
import type { ActionState } from "@/lib/portal/action-state";
import { cn } from "@/lib/utils";

export { compactControl };

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "outline" | "dark" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Lets one form offer several submit intents; only the clicked button shows its pending label. */
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const pending = status.pending && (!name || status.data?.get(name) === value);
  return (
    <Button
      type="submit"
      name={name}
      value={value}
      variant={variant}
      size={size}
      disabled={status.pending}
      aria-disabled={status.pending}
      className={className}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

export function CopyButton({ value, label = "Copy link" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function ShareLink({ link }: { link: string }) {
  return (
    <div className="mt-3 flex min-w-0 items-center gap-3 border border-line bg-white px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted">{link}</code>
      <CopyButton value={link} />
    </div>
  );
}

export function FormAlert({ state, onDismiss }: { state: ActionState; onDismiss?: () => void }) {
  if (state.status === "idle" || !state.message) return null;
  const ok = state.status === "success";
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2.5 border-l-2 px-4 py-3 text-sm",
        ok ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-red-600 bg-red-50 text-red-800",
      )}
    >
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p>{state.message}</p>
        {state.link && <ShareLink link={state.link} />}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export const SelectBox = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }>(
  ({ className, compact, children, ...props }, ref) => (
    <div className="relative">
      {compact ? (
        <select ref={ref} className={cn(compactControl, "w-full appearance-none pr-8", className)} {...props}>
          {children}
        </select>
      ) : (
        <Select ref={ref} className={className} {...props}>
          {children}
        </Select>
      )}
      <ChevronDown
        className={cn(
          "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted",
          compact ? "right-2.5" : "right-3.5",
        )}
      />
    </div>
  ),
);
SelectBox.displayName = "SelectBox";

/** Labelled input wired to a server action's field errors. */
export function Field({
  name,
  label,
  errors,
  hint,
  children,
  ...props
}: {
  name: string;
  label: string;
  errors?: Record<string, string>;
  hint?: string;
  children?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `${useId()}-${name}`;
  const error = errors?.[name];
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children ?? (
        <Input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
      )}
      {hint && !error && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function TextareaField({
  name,
  label,
  errors,
  hint,
  className,
  ...props
}: {
  name: string;
  label: string;
  errors?: Record<string, string>;
  hint?: ReactNode;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = `${useId()}-${name}`;
  const error = errors?.[name];
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={className}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  errors,
  children,
  ...props
}: {
  name: string;
  label: string;
  errors?: Record<string, string>;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = `${useId()}-${name}`;
  const error = errors?.[name];
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <SelectBox
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      >
        {children}
      </SelectBox>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="max-h-[calc(100dvh-2rem)] w-[min(640px,calc(100vw-1.5rem))] overflow-y-auto border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-night/50"
    >
      {open && (
        <div>
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold tracking-[-0.01em]">
                {title}
              </h2>
              {description && <div className="mt-1 text-sm text-ink-muted">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 grid h-9 w-9 shrink-0 place-items-center text-ink-muted hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 py-5 sm:px-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}
