import { LogoMark } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";

const bars = [38, 46, 44, 55, 61, 58, 70, 67, 78, 74, 86, 92];

const rows = [
  { company: "Northwind Traders", stage: "Negotiation", tone: "warning" as const, value: "$184,000" },
  { company: "Contoso Retail", stage: "Proposal", tone: "brand" as const, value: "$96,000" },
  { company: "Tailspin Toys", stage: "Closed won", tone: "success" as const, value: "$58,000" },
];

export function SoftwarePreview() {
  return (
    <div className="border border-line bg-white shadow-[0_24px_60px_-30px_rgba(0,0,0,0.25)]" aria-hidden="true">
      <div className="flex items-center justify-between bg-night px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.02em]">
            <LogoMark className="h-5 w-5" />
            Largis
          </span>
          <span className="h-4 w-px bg-white/30" />
          <span className="text-sm text-white/75">Sales Tracker</span>
        </div>
        <span className="rounded-full border border-white/30 px-3 py-0.5 text-xs text-white/85">Acme Corp</span>
      </div>
      <div className="flex items-center justify-between border-b border-line px-6 py-3 text-xs text-ink-subtle">
        <span>Overview</span>
        <span>Q3 FY26</span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
        {[
          ["Revenue", "$2.48M"],
          ["Active leads", "1,284"],
          ["Avg. chat reply", "38s"],
        ].map(([label, value]) => (
          <div key={label} className="px-6 py-5">
            <p className="text-xs text-ink-subtle">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{value}</p>
          </div>
        ))}
      </div>
      <div className="px-6 pt-6">
        <div className="flex h-32 items-end gap-1.5">
          {bars.map((h, i) => (
            <div
              key={i}
              className={i === bars.length - 1 ? "flex-1 bg-gold-500" : "flex-1 bg-gradient-to-t from-brand-700 to-brand-500"}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-ink-subtle">
          <span>Oct</span>
          <span>Sep</span>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
        {rows.map((row) => (
          <li key={row.company} className="flex items-center justify-between gap-4 px-6 py-3">
            <span>{row.company}</span>
            <span className="flex items-center gap-4">
              <Badge tone={row.tone}>{row.stage}</Badge>
              <span className="w-20 text-right tabular-nums text-ink-muted">{row.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
