import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { compactControl } from "@/components/portal/control-styles";
import { SelectBox } from "@/components/portal/forms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** GET form for list pages; filters live in the URL so views can be shared and bookmarked. */
export function FilterBar({
  action,
  filtered,
  children,
}: {
  action: string;
  filtered: boolean;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      method="get"
      role="search"
      className="flex flex-col gap-3 border border-line bg-white p-4 lg:flex-row lg:flex-wrap lg:items-end"
    >
      {children}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">
          Apply
        </Button>
        {filtered && (
          <Link href={action} className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}

export function FilterSearch({
  id,
  defaultValue,
  placeholder,
}: {
  id: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <div className="min-w-0 lg:min-w-[220px] lg:flex-1">
      <label htmlFor={id} className="mb-1.5 block text-xs text-ink-subtle">
        Search
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={cn(compactControl, "w-full pl-9")}
        />
      </div>
    </div>
  );
}

export function FilterSelect({
  id,
  name,
  label,
  defaultValue,
  children,
  className,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("lg:w-44", className)}>
      <label htmlFor={id} className="mb-1.5 block text-xs text-ink-subtle">
        {label}
      </label>
      <SelectBox compact id={id} name={name} defaultValue={defaultValue}>
        {children}
      </SelectBox>
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="print:hidden">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-ink-subtle">
        {items.map((item, i) => (
          <li key={i} className={cn("flex min-w-0 items-center gap-1.5", !item.href && "text-ink")}>
            {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
            {item.href ? (
              <Link href={item.href} className="truncate hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
