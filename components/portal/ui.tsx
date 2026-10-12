import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{title}</h1>
        {description && <div className="mt-2 text-[15px] text-ink-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid border-l border-t border-line bg-white sm:grid-cols-2 xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="border-b border-r border-line p-5">
      <p className="text-sm text-ink-subtle">{label}</p>
      <p className="mt-2 text-3xl tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("border border-line bg-white", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-14 text-center", className)}>
      {icon && <div className="mx-auto mb-4 grid h-11 w-11 place-items-center border border-line text-ink-subtle">{icon}</div>}
      <p className="text-[15px] font-medium">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{children}</div>}
    </div>
  );
}

export function NotConfigured() {
  return (
    <EmptyState title="The portal database is not connected">
      Supabase environment variables are missing on this deployment.
    </EmptyState>
  );
}
