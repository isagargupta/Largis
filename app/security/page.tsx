import type { Metadata } from "next";
import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { ArrowLink } from "@/components/ui/button";
import { Eyebrow, SectionHeading } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Security & Compliance",
  description: "How Largis Venture keeps client data separate, protected at the network edge, and encrypted.",
};

const controls = [
  {
    id: "isolation",
    title: "Data isolation",
    text: "Every record belongs to one client organisation. Row level security rules in our Postgres database check each request against the signed-in user's organisation, so one client can never read or change another's data, even if application code has a bug.",
    points: [
      "Each record stores an organisation ID",
      "Access is checked by the database on every query",
      "Roles limit what each person can see within their organisation",
    ],
  },
  {
    id: "network",
    title: "Network protection",
    text: "All public traffic is routed through Cloudflare before it reaches our hosting on Vercel. Requests are filtered by a web application firewall, rate-limited, and screened for bots and denial-of-service attacks.",
    points: [
      "Cloudflare web application firewall",
      "DDoS protection and rate limiting",
      "Servers accept traffic over HTTPS only",
    ],
  },
  {
    id: "encryption",
    title: "Encryption",
    text: "Data is encrypted whenever it moves between systems and whenever it is stored, including backups.",
    points: ["TLS 1.2 or higher on every connection", "AES-256 encryption for stored data", "Encrypted, access-controlled backups"],
  },
  {
    id: "access",
    title: "Staff access and audit",
    text: "Our own staff get the least access they need to do their job, and every action on production systems is recorded.",
    points: [
      "Multi-factor authentication for all staff accounts",
      "Support agents only see the systems and records assigned to them",
      "Access to production is logged and reviewed",
    ],
  },
];

const documents = [
  { label: "Security statement", href: "/legal/security" },
  { label: "Data processing addendum (DPA)", href: "/legal/dpa" },
  { label: "Privacy policy", href: "/legal/privacy" },
  { label: "Terms of service", href: "/legal/terms" },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        crumb="Security & Compliance"
        title="How we protect your data"
        intro="We handle order, customer, and sales data for our clients. These are the controls that keep it separate, protected, and encrypted."
        image="/images/data-center.jpg"
      />

      {controls.map((control, i) => (
        <section
          key={control.id}
          id={control.id}
          className={i % 2 === 0 ? "scroll-mt-20 bg-white" : "scroll-mt-20 bg-paper-soft"}
        >
          <div className="container grid gap-10 py-20 sm:py-24 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <Eyebrow index={String(i + 1).padStart(2, "0")}>Control</Eyebrow>
              <h2 className="display-2 mt-5">{control.title}</h2>
            </div>
            <div className="lg:col-span-7">
              <p className="text-lg leading-relaxed text-ink-muted">{control.text}</p>
              <ul className="mt-8 border-t border-line">
                {control.points.map((point) => (
                  <li key={point} className="border-b border-line py-4 text-[15px]">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ))}

      <section className="bg-white">
        <div className="container py-24 sm:py-28">
          <SectionHeading
            index="05"
            eyebrow="Documents"
            title="Policies and agreements"
            description="Our policies are available to read here. Signed copies are available on request."
          />
          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {documents.map((doc) => (
              <ArrowLink key={doc.href} href={doc.href}>
                {doc.label}
              </ArrowLink>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Have a security questionnaire?"
        text="Send it to us. Our team will complete it and walk your security reviewers through our setup."
      />
    </>
  );
}
