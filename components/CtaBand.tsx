import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { siteConfig } from "@/lib/site";

export function CtaBand({
  title = "Tell us what you need to run",
  text = "Share your current setup and where it falls short. A member of our team will reply within 2–4 business hours.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-black to-night-700 text-white">
      <div className="absolute inset-0 -z-10 bg-grid-navy bg-[length:48px_48px]" aria-hidden="true" />
      <div
        className="absolute -right-24 top-1/2 -z-10 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-gold-500/15 blur-[120px]"
        aria-hidden="true"
      />
      <div className="container grid gap-12 py-24 sm:py-28 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <Eyebrow tone="light">Next step</Eyebrow>
          <h2 className="display-2 mt-6">{title}</h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">{text}</p>
        </div>
        <div className="lg:col-span-4 lg:col-start-9">
          <ButtonLink href="/contact" size="lg" className="w-full sm:w-auto lg:w-full">
            Schedule a consultation
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <dl className="mt-8 space-y-3 border-t border-white/15 pt-6 font-mono text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">EMAIL</dt>
              <dd>
                <a href={`mailto:${siteConfig.email}`} className="text-white/85 hover:text-white">
                  {siteConfig.email}
                </a>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/50">RESPONSE</dt>
              <dd className="text-white/85">2–4 business hours</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
