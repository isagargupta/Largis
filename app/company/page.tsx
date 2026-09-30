import type { Metadata } from "next";
import Image from "next/image";
import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { SectionHeading } from "@/components/ui/card";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Company",
  description: "Largis Venture Private Limited: backend systems and customer support operations, based in Bangalore, India.",
};

const principles = [
  {
    title: "Clear commitments",
    text: "Scope, pricing, service levels, and reporting are agreed in writing before any work starts.",
  },
  {
    title: "One accountable team",
    text: "Each client has a named account lead who is responsible for delivery and is easy to reach.",
  },
  {
    title: "Security from the start",
    text: "Access controls and data separation are set up before we touch a client's systems.",
  },
];

export default function CompanyPage() {
  const corporate = [
    ["Registered name", siteConfig.legalName],
    ["Registered office", siteConfig.address],
    ["Corporate Identification Number (CIN)", siteConfig.cin],
    ["GST Identification Number (GSTIN)", siteConfig.gstin],
    ["Email", siteConfig.email],
  ];

  return (
    <>
      <PageHero
        crumb="Company"
        title="An operations partner based in Bangalore"
        intro="Largis Venture runs backend systems and customer support for companies in India and abroad. We combine engineers, trained support staff, and our own software under one contract."
        image="/images/team-meeting.jpg"
      />

      <section className="bg-white">
        <div className="container py-24 sm:py-28">
          <SectionHeading index="01" eyebrow="Principles" title="How we work" />
          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {principles.map((p) => (
              <div key={p.title} className="rule-accent pt-6">
                <h3 className="text-xl font-semibold tracking-[-0.02em]">{p.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="corporate" className="scroll-mt-20 bg-paper-soft">
        <div className="container grid gap-14 py-24 sm:py-28 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading index="02" eyebrow="Registration" title="Corporate information" />
            <div className="bracket mt-12">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src="/images/city-towers.jpg"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
          <dl className="rule-accent lg:col-span-7">
            {corporate.map(([label, value]) => (
              <div key={label} className="grid gap-1 border-b border-line py-5 sm:grid-cols-[260px_1fr] sm:gap-8">
                <dt className="text-sm text-ink-subtle">{label}</dt>
                <dd className="text-[17px] font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
