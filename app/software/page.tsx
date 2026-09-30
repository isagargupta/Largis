import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { SoftwarePreview } from "@/components/SoftwarePreview";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Software Suite",
  description: "Sales Tracker and the Largis client portal: revenue, leads, and support response times in one place.",
};

const trackerFeatures = [
  { title: "Several organisations, one login", text: "Switch between business units or brands. Each one's data stays separate." },
  { title: "Live figures", text: "Revenue, active leads, conversion rate, and chat response times update as work happens." },
  { title: "Pipeline view", text: "Filter leads by stage, source, and owner, and export what you are allowed to see." },
];

const portalFeatures = [
  { title: "Service reports", text: "Monthly uptime, incident, and support-quality reports in one place." },
  { title: "Stakeholder access", text: "Give finance, operations, and leadership their own logins with the right permissions." },
  { title: "Exports", text: "Download reports and lead lists as CSV for your own records." },
];

const roles = ["Owner", "Admin", "Manager", "Agent", "Viewer"] as const;
const permissions: { label: string; allowed: boolean[] }[] = [
  { label: "See all leads in the organisation", allowed: [true, true, true, false, true] },
  { label: "See deal values", allowed: [true, true, true, false, true] },
  { label: "Edit leads", allowed: [true, true, true, true, false] },
  { label: "Delete leads", allowed: [true, true, false, false, false] },
  { label: "Manage users and roles", allowed: [true, true, false, false, false] },
];

function FeatureList({ items }: { items: { title: string; text: string }[] }) {
  return (
    <dl className="mt-10 border-t border-line">
      {items.map((item) => (
        <div key={item.title} className="grid gap-2 border-b border-line py-5 sm:grid-cols-[220px_1fr] sm:gap-8">
          <dt className="text-[17px] font-medium">{item.title}</dt>
          <dd className="text-[15px] leading-relaxed text-ink-muted">{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function SoftwarePage() {
  return (
    <>
      <PageHero
        crumb="Software Suite"
        title="Software that shows how your operations are performing"
        intro="Every client gets access to the tools we use to run their service. You see the same numbers we do, as they happen."
      />

      <section id="sales-tracker" className="scroll-mt-20 bg-paper-soft">
        <div className="container grid items-center gap-14 py-24 sm:py-28 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              index="01"
              eyebrow="Product"
              title="Sales Tracker"
              description="Track revenue and leads across every organisation you run, with each one's data kept apart."
            />
            <FeatureList items={trackerFeatures} />
            <ButtonLink href="/app/sales-tracker" className="mt-10">
              Open the live preview
            </ButtonLink>
          </div>
          <SoftwarePreview />
        </div>
      </section>

      <section id="portal" className="scroll-mt-20 bg-white">
        <div className="container py-24 sm:py-28">
          <SectionHeading
            index="02"
            eyebrow="Product"
            title="Client portal"
            description="A single place for your stakeholders to check service performance without waiting for a report."
          />
          <div className="max-w-4xl">
            <FeatureList items={portalFeatures} />
          </div>
        </div>
      </section>

      <section id="access" className="scroll-mt-20 bg-paper-soft">
        <div className="container py-24 sm:py-28">
          <SectionHeading
            index="03"
            eyebrow="Access control"
            title="Roles and access"
            description="Each person gets the least access they need. The same rules are enforced in the database, not only in the interface."
          />
          <div className="mt-12 overflow-x-auto border border-line bg-white">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-6 py-4 font-normal text-ink-subtle">
                    Permission
                  </th>
                  {roles.map((role) => (
                    <th key={role} scope="col" className="px-4 py-4 text-center font-normal">
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {permissions.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="px-6 py-4">
                      {row.label}
                    </th>
                    {row.allowed.map((ok, i) => (
                      <td key={roles[i]} className="px-4 py-4 text-center">
                        {ok ? (
                          <Check className="mx-auto h-4 w-4 text-brand-600" aria-label="Allowed" />
                        ) : (
                          <Minus className="mx-auto h-4 w-4 text-neutral-300" aria-label="Not allowed" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-ink-subtle">
            Agents can only see and edit leads assigned to them.
          </p>
        </div>
      </section>

      <CtaBand
        title="See the software with your own data"
        text="We can set up a trial workspace for your organisation as part of a consultation."
      />
    </>
  );
}
