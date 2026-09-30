import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaBand } from "@/components/CtaBand";
import { EngagementSteps } from "@/components/EngagementSteps";
import { SoftwarePreview } from "@/components/SoftwarePreview";
import { SuiteVisual } from "@/components/SuiteVisual";
import { ArrowTile, ButtonLink, TextLink } from "@/components/ui/button";
import { Eyebrow, SectionHeading } from "@/components/ui/card";

const facts = [
  { value: "99.9%", label: "Uptime commitment written into every service contract" },
  { value: "24/7", label: "Live chat support staffed by trained people" },
  { value: "Tier 1–3", label: "Technical escalation handled by our own engineers" },
  { value: "2–4 hrs", label: "Reply time for new enquiries on business days" },
];

const services: { title: string; text: string; image?: string; href: string }[] = [
  {
    title: "Backend & wholesale systems",
    text: "Business process automation, custom API integrations, inventory sync, and round-the-clock monitoring.",
    image: "/images/systems-integration.jpg",
    href: "/services#backend",
  },
  {
    title: "Customer support operations",
    text: "24/7 live chat teams with Tier 1 to Tier 3 technical escalation, run to response times set in your contract.",
    image: "/images/support-team.jpg",
    href: "/services#support",
  },
  {
    title: "Software Suite",
    text: "Largis Sales Tracker: revenue, leads, and support response times across your business units in one place.",
    href: "/software",
  },
];

const softwarePoints = [
  "Sales tracking across several organisations or business units",
  "Lead and revenue reporting that updates as your team works",
  "A client portal with role-based access for your stakeholders",
];

const security = [
  {
    title: "Separate data for every client",
    text: "Each record is tagged with the client's organisation. Database rules (row level security) stop anyone outside that organisation from reading or changing it.",
  },
  {
    title: "Protected at the network edge",
    text: "All traffic passes through Cloudflare's web application firewall and DDoS protection before it reaches our servers.",
  },
  {
    title: "Encrypted in transit and at rest",
    text: "Connections use TLS 1.2 or higher. Stored data and backups are encrypted with AES-256.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="bg-paper">
        <div className="container pb-16 pt-16 sm:pb-20 sm:pt-24">
          <Eyebrow>Backend systems · Support operations · Software</Eyebrow>
          <h1 className="display-1 mt-8 max-w-5xl">
            We run the <span className="text-brand-600">backend systems</span> and{" "}
            <span className="text-brand-600">support teams</span> your business depends on.
          </h1>
          <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:items-end">
            <p className="text-lg leading-relaxed text-ink-muted sm:text-xl lg:col-span-7">
              Largis Venture manages wholesale and backend systems and provides 24/7 live chat support for growing
              companies and large enterprises.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
              <ButtonLink href="/contact" size="lg">
                Schedule a consultation
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="#software" variant="outline" size="lg">
                Explore Software Suite
              </ButtonLink>
            </div>
          </div>
        </div>
        <div className="container pb-4">
          <div className="bracket">
            <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[21/9]">
              <Image
                src="/images/office-bright.jpg"
                alt="Bright, open-plan office with desks and meeting space"
                fill
                priority
                sizes="(min-width: 1360px) 1256px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Commitments" className="bg-paper">
        <div className="container grid gap-10 py-20 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {facts.map((fact) => (
            <div key={fact.value} className="rule-accent pt-6">
              <p className="text-[2.75rem] font-normal leading-none tracking-[-0.04em]">{fact.value}</p>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">{fact.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="services" className="bg-paper-soft">
        <div className="container py-24 sm:py-28">
          <SectionHeading
            index="01"
            eyebrow="What we do"
            title="Systems and support work that has to run every day"
            description="We take it on under one contract, so your own team can focus on the business."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {services.map((service, i) => (
              <Link
                key={service.title}
                href={service.href}
                className="group relative flex flex-col border border-line bg-white transition-colors hover:border-gold-300"
              >
                <span
                  className="absolute inset-x-0 top-0 z-10 h-[3px] origin-left scale-x-0 bg-gold-500 transition-transform duration-300 group-hover:scale-x-100"
                  aria-hidden="true"
                />
                <div className="relative aspect-[4/3] overflow-hidden">
                  {service.image ? (
                    <Image
                      src={service.image}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <SuiteVisual className="transition-transform duration-500 group-hover:scale-105" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{service.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{service.text}</p>
                  <div className="mt-auto flex items-center justify-between pt-8">
                    <span className="font-mono text-xs text-ink-subtle">{String(i + 1).padStart(2, "0")}</span>
                    <ArrowTile />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <EngagementSteps index="02" />

      <section id="software" className="scroll-mt-20 bg-paper-soft">
        <div className="container grid items-center gap-14 py-24 sm:py-28 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              index="03"
              eyebrow="Software Suite"
              title="See what we do, as it happens"
              description="Every engagement includes access to our own software, so you can see what we are doing and how it is performing."
            />
            <ul className="mt-10 border-t border-line">
              {softwarePoints.map((point) => (
                <li key={point} className="flex items-center gap-3 border-b border-line py-4 text-[15px]">
                  <span className="h-1.5 w-1.5 shrink-0 bg-gold-500" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              <ButtonLink href="/app/sales-tracker">Open the live preview</ButtonLink>
              <TextLink href="/software">About the software</TextLink>
            </div>
          </div>
          <div className="bracket">
            <SoftwarePreview />
          </div>
        </div>
      </section>

      <section id="security" className="scroll-mt-20 bg-paper">
        <div className="container py-24 sm:py-28">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              index="04"
              eyebrow="Security & Compliance"
              title="Client data kept separate, protected, and encrypted"
              description="How we protect client data, from the network edge down to individual database records."
            />
            <TextLink href="/security" className="shrink-0">
              How we protect data
            </TextLink>
          </div>
          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {security.map((item) => (
              <div key={item.title} className="rule-accent pt-6">
                <h3 className="text-xl font-semibold tracking-[-0.02em]">{item.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
