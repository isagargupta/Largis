import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Joining form",
  robots: { index: false, follow: false },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5">
          <Logo tone="dark" />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-subtle">Employee joining</p>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
        {children}
      </main>
      <footer className="mx-auto max-w-3xl px-5 pb-10 text-xs text-ink-subtle">
        {siteConfig.legalName}. This page is private and is not listed on the website.
      </footer>
    </div>
  );
}
