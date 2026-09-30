import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { SocialIcon } from "@/components/SocialIcon";
import { Eyebrow } from "@/components/ui/card";
import { serviceInterests, siteConfig, socialLinks, type ServiceInterest } from "@/lib/site";

export const metadata: Metadata = {
  title: "Schedule a Consultation",
  description: "Contact Largis Venture about backend systems support, live chat support operations, or our software.",
};

export default function ContactPage({ searchParams }: { searchParams: { interest?: string } }) {
  const defaultInterest = serviceInterests.find((s) => s === searchParams.interest) as ServiceInterest | undefined;

  const details = [
    {
      title: "Email",
      body: (
        <a href={`mailto:${siteConfig.email}`} className="text-brand-600 underline-offset-4 hover:underline">
          {siteConfig.email}
        </a>
      ),
    },
    { title: "Address", body: <address className="not-italic">{siteConfig.address}</address> },
    { title: "Response time", body: siteConfig.responseSla },
    {
      title: "Follow us",
      body: (
        <ul className="space-y-2.5">
          {socialLinks.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 text-ink hover:text-brand-600"
              >
                <SocialIcon icon={s.icon} className="h-4 w-4 text-brand-600" />
                <span>
                  {s.label} <span className="text-ink-subtle">· {s.handle}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <section className="bg-paper">
      <div className="container pb-24 pt-10 sm:pb-28">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-sm text-ink-subtle">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="text-ink">
              Contact
            </li>
          </ol>
        </nav>

        <Eyebrow className="mt-12">Contact</Eyebrow>
        <h1 className="display-1 mt-6 max-w-3xl">Schedule a consultation</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted sm:text-xl">
          Tell us about your systems and support needs. Someone from our team will review your message and reply with
          next steps.
        </p>

        <div className="mt-16 grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <ContactForm defaultInterest={defaultInterest} />
          </div>

          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="bg-paper-soft p-8">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">Contact details</h2>
              <dl className="mt-6">
                {details.map((d) => (
                  <div key={d.title} className="border-t border-line py-5">
                    <dt className="text-sm text-ink-subtle">{d.title}</dt>
                    <dd className="mt-2 text-[15px] leading-relaxed">{d.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
