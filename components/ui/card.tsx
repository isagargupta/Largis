import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border border-line bg-white", className)} {...props} />;
}

/** Monospaced section label, e.g. "01 / What we do". */
export function Eyebrow({
  index,
  children,
  tone = "dark",
  className,
}: {
  index?: string;
  children: React.ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.12em]",
        tone === "dark" ? "text-ink-subtle" : "text-white/60",
        className,
      )}
    >
      <span className={cn("h-2 w-2", tone === "dark" ? "bg-gold-500" : "bg-gold-400")} aria-hidden="true" />
      {index && <span className={tone === "dark" ? "text-gold-700" : "text-gold-300"}>{index}</span>}
      {index && <span aria-hidden="true">/</span>}
      <span>{children}</span>
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  index,
  title,
  description,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  index?: string;
  title: string;
  description?: string;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {eyebrow && (
        <Eyebrow index={index} className="mb-5">
          {eyebrow}
        </Eyebrow>
      )}
      <Tag className="display-2">{title}</Tag>
      {description && <p className="mt-5 text-lg leading-relaxed text-ink-muted">{description}</p>}
    </div>
  );
}
