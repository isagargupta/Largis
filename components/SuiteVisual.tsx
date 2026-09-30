import { LogoMark } from "@/components/Logo";
import { cn } from "@/lib/utils";

const revenue = [42, 48, 45, 56, 61, 58, 69, 66, 77, 74, 85, 93];

function chartPaths(values: number[], width = 300, height = 100) {
  const max = Math.max(...values) * 1.08;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => [i * step, height - (v / max) * height] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${width},${height} L0,${height} Z`, last: points[points.length - 1] };
}

const metrics = [
  { label: "Revenue", value: "$2.48M", delta: "+18.2%" },
  { label: "Active leads", value: "1,284", delta: "+6.4%" },
  { label: "Chat reply", value: "38s", delta: "−12.5%" },
];

const leads = [
  { company: "Northwind Traders", stage: "Negotiation", tone: "bg-amber-50 text-amber-800", value: "$184,000" },
  { company: "Contoso Retail", stage: "Proposal", tone: "bg-brand-50 text-brand-700", value: "$96,000" },
];

/** Branded, illustrative rendering of the Largis Sales Tracker for cards and menus. Fills its positioned parent. */
export function SuiteVisual({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { line, area, last } = chartPaths(revenue);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 bg-gradient-to-br from-brand-100 via-brand-50 to-white",
        compact ? "p-3" : "p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex h-full flex-col overflow-hidden border border-black/10 bg-white text-ink shadow-[0_18px_40px_-20px_rgba(28,53,95,0.45)]">
        <div className="flex h-8 shrink-0 items-center justify-between bg-navy px-3 text-white">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-bold tracking-[-0.02em]">
              <LogoMark className="h-3.5 w-3.5" />
              Largis
            </span>
            <span className="h-3 w-px bg-white/30" />
            <span className="text-[10px] text-white/70">Sales Tracker</span>
          </div>
          <span className="rounded-full border border-white/30 px-2 py-px text-[9px] text-white/80">Acme Corp</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
          <div className="grid shrink-0 grid-cols-3 gap-2">
            {metrics.map((m) => (
              <div key={m.label} className="border border-line px-2 py-1.5">
                <p className="text-[9px] leading-tight text-ink-subtle">{m.label}</p>
                <p className="text-[15px] leading-snug">{m.value}</p>
                <p className="text-[9px] leading-tight text-emerald-700">{m.delta}</p>
              </div>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col border border-line p-2">
            <div className="flex shrink-0 items-center justify-between">
              <p className="text-[9px] text-ink-subtle">Revenue, last 12 months</p>
              <p className="text-[9px] text-brand-700">Live</p>
            </div>
            <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="mt-1 min-h-0 w-full flex-1">
              {[25, 50, 75].map((y) => (
                <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#ececec" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              ))}
              <path d={area} fill="#3a73c9" fillOpacity="0.14" />
              <path d={line} fill="none" stroke="#2a5db0" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <circle cx={last[0]} cy={last[1]} r="3.5" fill="#2a5db0" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>

          {!compact && (
            <ul className="shrink-0 divide-y divide-line border border-line">
              {leads.map((l) => (
                <li key={l.company} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[10px]">
                  <span className="truncate">{l.company}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={cn("rounded-full px-1.5 py-px text-[9px]", l.tone)}>{l.stage}</span>
                    <span className="w-14 text-right tabular-nums text-ink-muted">{l.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
