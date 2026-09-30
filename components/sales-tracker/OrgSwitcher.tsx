"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { Organization } from "@/lib/mock/sales-tracker";
import { cn } from "@/lib/utils";

export function OrgSwitcher({
  organizations,
  activeId,
  onChange,
}: {
  organizations: Organization[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = organizations.find((o) => o.id === activeId) ?? organizations[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border border-[#c8c8c8] bg-white px-4 py-2 text-left transition-colors hover:border-ink-subtle sm:w-auto sm:min-w-[250px]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-ink-subtle">Active organisation</span>
          <span className="block truncate text-[15px]">{active.name}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-subtle" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Switch organisation"
          className="absolute left-0 z-20 mt-1 w-full min-w-[280px] border border-line bg-white py-1 shadow-lg"
        >
          {organizations.map((org) => {
            const selected = org.id === active.id;
            return (
              <li key={org.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(org.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-paper-soft",
                    selected && "bg-paper-soft",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{org.name}</span>
                    <span className="block font-mono text-[11px] text-ink-subtle">
                      {org.id} · {org.region}
                    </span>
                  </span>
                  <span className="text-xs text-ink-subtle">{org.plan}</span>
                  {selected && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
