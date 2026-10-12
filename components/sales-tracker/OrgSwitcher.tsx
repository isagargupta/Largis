"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SwitcherOrg = { id: string; name: string; region?: string | null; plan?: string | null };

export function OrgSwitcher({
  organizations,
  activeId,
  onChange,
  tone = "light",
  showIds = true,
  disabled = false,
}: {
  organizations: SwitcherOrg[];
  activeId: string;
  onChange: (id: string) => void;
  tone?: "light" | "dark";
  showIds?: boolean;
  disabled?: boolean;
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
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 border px-4 py-2 text-left transition-colors disabled:opacity-60 sm:w-auto sm:min-w-[250px]",
          tone === "light"
            ? "border-[#d6d0c4] bg-white hover:border-ink-subtle"
            : "border-white/15 bg-white/5 text-white hover:border-white/40",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block text-xs", tone === "light" ? "text-ink-subtle" : "text-white/55")}>
            Active organisation
          </span>
          <span className="block truncate text-[15px]">{active.name}</span>
        </span>
        <ChevronsUpDown className={cn("h-4 w-4 shrink-0", tone === "light" ? "text-ink-subtle" : "text-white/55")} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Switch organisation"
          className="absolute left-0 z-30 mt-1 w-full min-w-[min(280px,calc(100vw-2.5rem))] border border-line bg-white py-1 text-ink shadow-lg"
        >
          {organizations.map((org) => {
            const selected = org.id === active.id;
            const meta = [showIds ? org.id : null, org.region].filter(Boolean).join(" · ");
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
                    {meta && <span className="block font-mono text-[11px] text-ink-subtle">{meta}</span>}
                  </span>
                  {org.plan && <span className="text-xs text-ink-subtle">{org.plan}</span>}
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
