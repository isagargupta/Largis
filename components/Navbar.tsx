"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SuiteVisual } from "@/components/SuiteVisual";
import { Eyebrow } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { mainNav } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const [active, setActive] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<number | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setActive(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        triggerRefs.current[active]?.focus();
        setActive(null);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [active]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const menu = active !== null ? mainNav[active] : null;

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-50 bg-navy text-white">
        <nav className="container flex h-[72px] items-center justify-between gap-8" aria-label="Primary">
          <Logo />

          <ul className="hidden h-full items-center gap-7 xl:flex">
            {mainNav.map((item, i) => {
              const open = active === i;
              const current = pathname.startsWith(item.href);
              return (
                <li key={item.label} className="flex h-full items-center">
                  <button
                    ref={(el) => {
                      triggerRefs.current[i] = el;
                    }}
                    type="button"
                    aria-expanded={open}
                    aria-controls="mega-menu"
                    onClick={() => setActive(open ? null : i)}
                    className={cn(
                      "flex h-full items-center gap-1.5 border-b-2 pt-0.5 text-sm font-medium transition-colors",
                      open ? "border-brand-400 text-white" : "border-transparent text-white/75 hover:text-white",
                      current && !open && "text-white",
                    )}
                  >
                    {item.label}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hidden items-center gap-6 xl:flex">
            <Link href="/login" className="text-sm font-medium text-white/75 transition-colors hover:text-white">
              Sign in
            </Link>
            <ButtonLink href="/contact" size="sm">
              Schedule consultation
            </ButtonLink>
          </div>

          <button
            type="button"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-white xl:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>

        {menu && (
          <div
            id="mega-menu"
            className="absolute inset-x-0 top-full hidden animate-menu-in border-b border-line bg-white text-ink shadow-[0_24px_48px_-24px_rgba(10,22,40,0.35)] xl:block"
          >
            <div className="container grid grid-cols-12 gap-10 py-12">
              <div className="col-span-3">
                <Eyebrow>{menu.intro.title}</Eyebrow>
                <p className="mt-5 text-[15px] leading-relaxed text-ink-muted">{menu.intro.text}</p>
                <Link
                  href={menu.intro.cta.href}
                  onClick={() => setActive(null)}
                  className="group mt-10 inline-flex items-center gap-2 text-[15px] font-semibold text-brand-700"
                >
                  {menu.intro.cta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              <ul className="col-span-4">
                {menu.links.map((link) => (
                  <li key={link.href} className="border-b border-line">
                    <Link
                      href={link.href}
                      onClick={() => setActive(null)}
                      className="group flex items-center justify-between py-3.5 text-[15px] font-medium text-ink transition-colors hover:text-brand-700"
                    >
                      {link.label}
                      <ChevronRight className="h-4 w-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" />
                    </Link>
                  </li>
                ))}
              </ul>

              <Link
                href={menu.feature.href}
                onClick={() => setActive(null)}
                className="group col-span-4 col-start-9"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  {menu.feature.image ? (
                    <Image
                      src={menu.feature.image}
                      alt=""
                      fill
                      sizes="400px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <SuiteVisual compact />
                  )}
                </div>
                <p className="mt-4 flex items-start justify-between gap-4 text-sm font-medium text-ink group-hover:text-brand-700">
                  {menu.feature.title}
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
                </p>
              </Link>
            </div>
          </div>
        )}
      </header>

      {menu && (
        <div
          className="fixed inset-0 top-[72px] z-40 hidden bg-navy/40 xl:block"
          aria-hidden="true"
          onClick={() => setActive(null)}
        />
      )}

      <div
        id="mobile-nav"
        hidden={!mobileOpen}
        className="fixed inset-x-0 bottom-0 top-[72px] z-40 overflow-y-auto border-t border-white/10 bg-navy text-white xl:hidden"
      >
        <div className="container flex min-h-full flex-col pb-10 pt-4">
          <ul>
            {mainNav.map((item, i) => {
              const expanded = mobileSection === i;
              return (
                <li key={item.label} className="border-b border-white/15">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setMobileSection(expanded ? null : i)}
                    className="flex w-full items-center justify-between py-5 text-left text-lg"
                  >
                    {item.label}
                    <ChevronDown className={cn("h-5 w-5 transition-transform", expanded && "rotate-180")} />
                  </button>
                  {expanded && (
                    <div className="pb-6">
                      <p className="text-[15px] leading-relaxed text-white/60">{item.intro.text}</p>
                      <ul className="mt-4">
                        {item.links.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              onClick={() => setMobileOpen(false)}
                              className="flex items-center justify-between py-2.5 text-[15px] text-white/80"
                            >
                              {link.label}
                              <ChevronRight className="h-4 w-4 text-white/50" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-auto grid gap-3 pt-10">
            <ButtonLink href="/login" variant="outline-light" size="lg" onClick={() => setMobileOpen(false)}>
              Sign in
            </ButtonLink>
            <ButtonLink href="/contact" size="lg" onClick={() => setMobileOpen(false)}>
              Schedule consultation
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}
