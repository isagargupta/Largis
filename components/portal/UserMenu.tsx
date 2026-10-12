"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuLinkItem = { label: string; href: string };

export function UserMenu({
  name,
  email,
  roleLabel,
  links = [],
  tone = "dark",
}: {
  name: string;
  email: string;
  roleLabel?: string;
  links?: MenuLinkItem[];
  tone?: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = (name || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

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
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 py-1.5 pl-1.5 pr-2 transition-colors",
          tone === "dark" ? "text-white/80 hover:text-white" : "text-ink-muted hover:text-ink",
        )}
      >
        <span
          className={cn(
            "grid h-8 w-8 place-items-center font-mono text-xs",
            tone === "dark" ? "bg-white/10 text-white" : "bg-night text-white",
          )}
          aria-hidden="true"
        >
          {initials || "?"}
        </span>
        <span className="hidden max-w-[160px] truncate text-sm md:block">{name || email}</span>
        <ChevronDown className="hidden h-4 w-4 md:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] animate-menu-in border border-line bg-white text-ink shadow-lg"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium">{name || email}</p>
            {name && <p className="truncate text-xs text-ink-subtle">{email}</p>}
            {roleLabel && (
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-gold-700">{roleLabel}</p>
            )}
          </div>
          {links.length > 0 && (
            <ul className="border-b border-line py-1">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    role="menuitem"
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-paper-soft"
                  >
                    {link.label}
                    {/^https?:\/\//.test(link.href) && <ArrowUpRight className="h-4 w-4 text-ink-subtle" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <form action="/auth/signout" method="post" className="py-1">
            <button
              role="menuitem"
              type="submit"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
