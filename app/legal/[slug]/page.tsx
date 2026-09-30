import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { legalDocs } from "@/lib/legal";
import { legalNav } from "@/lib/site";
import { cn } from "@/lib/utils";

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return Object.keys(legalDocs).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const doc = legalDocs[params.slug];
  return doc ? { title: doc.title, description: doc.summary } : {};
}

export const dynamicParams = false;

export default function LegalPage({ params }: Props) {
  const doc = legalDocs[params.slug];
  if (!doc) notFound();

  return (
    <div className="bg-white">
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
              {doc.title}
            </li>
          </ol>
        </nav>

        <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-16">
          <nav aria-label="Legal documents" className="lg:sticky lg:top-28 lg:col-span-3 lg:self-start">
            <ul className="border-t border-line">
              {legalNav.map((item) => {
                const active = item.href.endsWith(`/${params.slug}`);
                return (
                  <li key={item.href} className="border-b border-line">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between py-3.5 text-[15px] transition-colors",
                        active ? "text-ink" : "text-ink-muted hover:text-ink",
                      )}
                    >
                      {item.label}
                      {active && <ChevronRight className="h-4 w-4" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <article className="max-w-3xl lg:col-span-8 lg:col-start-5">
            <h1 className="display-2">{doc.title}</h1>
            <p className="mt-5 text-lg text-ink-muted">{doc.summary}</p>
            <p className="mt-3 text-sm text-ink-subtle">Last updated: September 1, 2026</p>

            <div className="mt-14 space-y-12">
              {doc.sections.map((section, i) => (
                <section key={section.heading} className="border-t border-line pt-8">
                  <h2 className="text-xl font-semibold tracking-[-0.02em]">
                    <span className="mr-3 text-sm text-ink-subtle">{String(i + 1).padStart(2, "0")}</span>
                    {section.heading}
                  </h2>
                  <p className="mt-4 text-[16px] leading-relaxed text-ink-muted">{section.body}</p>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
