import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("h-7 w-7", className)} aria-hidden="true">
      <rect x="2" y="2" width="6.5" height="24" fill="currentColor" />
      <rect x="2" y="19.5" width="24" height="6.5" fill="currentColor" />
      <rect x="15" y="2" width="11" height="11" fill="#6d83f7" />
    </svg>
  );
}

export function Logo({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <Link
      href="/"
      aria-label="Largis Venture home"
      className={cn("inline-flex items-center gap-2.5", tone === "light" ? "text-white" : "text-ink", className)}
    >
      <LogoMark />
      <span className="text-[19px] leading-none tracking-[-0.03em]">
        <span className="font-bold">Largis</span>{" "}
        <span className={cn("font-normal", tone === "light" ? "text-white/65" : "text-ink-muted")}>Venture</span>
      </span>
    </Link>
  );
}
