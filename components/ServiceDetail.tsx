import Image from "next/image";
import { Eyebrow } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ServiceDetail({
  id,
  index,
  title,
  intro,
  items,
  image,
  imageAlt,
  commitments,
  tone = "white",
}: {
  id: string;
  index: string;
  title: string;
  intro: string;
  items: { title: string; text: string }[];
  image: string;
  imageAlt: string;
  commitments: string[];
  tone?: "white" | "soft";
}) {
  return (
    <section id={id} className={cn("scroll-mt-20", tone === "soft" ? "bg-paper-soft" : "bg-paper")}>
      <div className="container py-24 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Eyebrow index={index}>Service</Eyebrow>
            <h2 className="display-2 mt-5">{title}</h2>
            <p className="mt-6 text-lg leading-relaxed text-ink-muted">{intro}</p>
            <div className="bracket mt-12">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image src={image} alt={imageAlt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-ink-subtle">What is included</h3>
            <dl className="mt-6 grid gap-x-8 sm:grid-cols-2">
              {items.map((item) => (
                <div key={item.title} className="rule-accent py-6">
                  <dt className="text-xl font-semibold tracking-[-0.02em]">{item.title}</dt>
                  <dd className="mt-3 text-[15px] leading-relaxed text-ink-muted">{item.text}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-12 font-mono text-xs uppercase tracking-[0.12em] text-ink-subtle">Our commitments</h3>
            <ul className="mt-6 border-t border-line">
              {commitments.map((c) => (
                <li key={c} className="flex items-center gap-3 border-b border-line py-4 text-[15px]">
                  <span className="h-1.5 w-1.5 shrink-0 bg-gold-500" aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
