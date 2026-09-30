import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "outline-light" | "dark" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  dark: "bg-navy text-white hover:bg-navy-700",
  outline: "border border-ink/25 bg-white text-ink hover:border-ink",
  "outline-light":
    "border border-white/30 text-white hover:border-white hover:bg-white/5 focus-visible:ring-offset-navy",
  ghost: "text-ink hover:bg-paper-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-[52px] px-7 text-[15px]",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
));
Button.displayName = "Button";

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={buttonVariants({ variant, size, className })} {...props} />;
}

/** Text link with a trailing arrow and a full-width rule underneath. */
export function ArrowLink({
  className,
  children,
  tone = "dark",
  ...props
}: ComponentProps<typeof Link> & { tone?: "dark" | "light" }) {
  return (
    <Link
      className={cn(
        "group flex items-center justify-between gap-4 border-b pb-3 text-[15px] font-medium transition-colors",
        tone === "dark" ? "border-line text-ink hover:border-brand-600 hover:text-brand-700" : "border-white/30 text-white hover:border-white",
        className,
      )}
      {...props}
    >
      {children}
      <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Inline text link with a trailing arrow. */
export function TextLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "group inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800",
        className,
      )}
      {...props}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

/** Square arrow tile used on cards; fills with cobalt when the parent `group` is hovered. */
export function ArrowTile({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-line text-ink transition-colors group-hover:border-brand-600 group-hover:bg-brand-600 group-hover:text-white",
        className,
      )}
    >
      <ArrowUpRight className="h-4 w-4" />
    </span>
  );
}
