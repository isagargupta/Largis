"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Briefcase,
  Building2,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessagesSquare,
  ReceiptText,
  ScrollText,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/Logo";
import { portalHref } from "@/lib/portal/hosts";
import { cn } from "@/lib/utils";

const icons = {
  overview: LayoutDashboard,
  sales: TrendingUp,
  team: Users,
  support: LifeBuoy,
  messages: MessagesSquare,
  reports: BarChart3,
  enquiries: Inbox,
  clients: Building2,
  delivery: Briefcase,
  billing: ReceiptText,
  audit: ScrollText,
  security: KeyRound,
} satisfies Record<string, LucideIcon>;

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof icons;
  disabled?: boolean;
  count?: number;
};

type Variant = "client" | "staff";

function isActive(pathname: string, href: string, root: string) {
  return href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  items,
  variant,
  root,
  onNavigate,
}: {
  items: NavItem[];
  variant: Variant;
  root: string;
  onNavigate?: () => void;
}) {
  const pathname = portalHref(usePathname());
  const dark = variant === "staff";

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = icons[item.icon];
        if (item.disabled) {
          return (
            <li key={item.label}>
              <span
                aria-disabled="true"
                className={cn(
                  "flex items-center gap-3 border-l-2 border-transparent px-3 py-2 text-sm",
                  dark ? "text-white/35" : "text-ink-subtle/80",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.1em]",
                    dark ? "text-white/35" : "text-ink-subtle",
                  )}
                >
                  Coming soon
                </span>
              </span>
            </li>
          );
        }

        const active = isActive(pathname, item.href, root);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors",
                dark
                  ? active
                    ? "border-gold-400 bg-white/[0.06] text-white"
                    : "border-transparent text-white/65 hover:bg-white/[0.04] hover:text-white"
                  : active
                    ? "border-brand-600 bg-brand-50 text-ink"
                    : "border-transparent text-ink-muted hover:bg-paper-soft hover:text-ink",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", dark && active && "text-gold-300")} />
              <span className="flex-1">{item.label}</span>
              {item.count ? (
                <span
                  className={cn(
                    "min-w-[1.5rem] rounded-full px-1.5 text-center text-xs tabular-nums",
                    dark ? "bg-gold-400/20 text-gold-200" : "bg-brand-100 text-brand-700",
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PortalShell({
  variant,
  root,
  label,
  nav,
  headerSlot,
  drawerSlot,
  userMenu,
  sidebarFooter,
  children,
}: {
  variant: Variant;
  root: string;
  label: string;
  nav: NavItem[];
  headerSlot?: ReactNode;
  drawerSlot?: ReactNode;
  userMenu: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const staff = variant === "staff";

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menuButton = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      aria-controls="portal-nav"
      aria-label={open ? "Close navigation" : "Open navigation"}
      className={cn(
        "-ml-2 grid h-10 w-10 shrink-0 place-items-center lg:hidden",
        staff ? "text-ink" : "text-white",
      )}
    >
      {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );

  const brand = staff ? (
    <Link href={root} aria-label={`${label} home`} className="flex min-w-0 items-center gap-3 text-white">
      <LogoMark className="shrink-0" />
      <span className="min-w-0 leading-none">
        <span className="block text-[18px] font-bold tracking-[-0.03em]">Largis</span>
        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-gold-300">Workspace</span>
      </span>
    </Link>
  ) : (
    <div className="flex min-w-0 items-center gap-3">
      <Logo href={root} className="shrink-0 [&>span]:hidden sm:[&>span]:inline" />
      <span className="hidden h-5 w-px bg-white/20 sm:block" aria-hidden="true" />
      <span className="hidden truncate font-mono text-[11px] uppercase tracking-[0.14em] text-gold-300 sm:block">
        {label}
      </span>
    </div>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      {drawerSlot && <div className="mb-5 lg:hidden">{drawerSlot}</div>}
      <nav aria-label={label}>
        <NavList items={nav} variant={variant} root={root} onNavigate={() => setOpen(false)} />
      </nav>
      {sidebarFooter && <div className="mt-auto pt-8">{sidebarFooter}</div>}
    </div>
  );

  if (staff) {
    return (
      <div className="flex min-h-screen bg-paper print:block print:bg-white">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-night-700 to-night text-white lg:flex print:!hidden">
          <div className="flex h-16 items-center border-b border-white/10 px-5">{brand}</div>
          <div className="h-[2px] w-12 bg-gold-500" aria-hidden="true" />
          <div className="flex-1 overflow-y-auto px-3 py-6">{sidebar}</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur print:hidden">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
              {menuButton}
              <div className="flex min-w-0 items-center gap-2 lg:hidden">
                <span className="h-2 w-2 shrink-0 bg-gold-500" aria-hidden="true" />
                <span className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-ink-subtle">{label}</span>
              </div>
              <div className="ml-auto flex items-center gap-3">
                {headerSlot}
                {userMenu}
              </div>
            </div>
          </header>

          {open && (
            <div
              id="portal-nav"
              className="fixed inset-x-0 bottom-0 top-16 z-30 overflow-y-auto bg-gradient-to-b from-night-700 to-night px-3 py-6 text-white lg:hidden"
            >
              {sidebar}
            </div>
          )}

          <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper print:block print:bg-white">
      <header className="sticky top-0 z-40 bg-gradient-to-b from-night-700 to-night text-white print:hidden">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          {menuButton}
          {brand}
          <div className="ml-auto flex min-w-0 items-center gap-3">
            {headerSlot && <div className="hidden min-w-0 md:block">{headerSlot}</div>}
            {userMenu}
          </div>
        </div>
      </header>

      <div className="flex flex-1 print:block">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-white px-3 py-6 lg:block print:!hidden">
          {sidebar}
        </aside>

        {open && (
          <div id="portal-nav" className="fixed inset-x-0 bottom-0 top-16 z-30 overflow-y-auto bg-white px-3 py-6 lg:hidden print:hidden">
            {sidebar}
          </div>
        )}

        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
