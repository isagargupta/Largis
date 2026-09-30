import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Eyebrow } from "@/components/ui/card";

export function PageHero({
  crumb,
  title,
  intro,
  image,
}: {
  crumb: string;
  title: string;
  intro: string;
  image?: string;
}) {
  return (
    <section className="bg-paper">
      <div className="container pb-14 pt-10 sm:pb-20">
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
              {crumb}
            </li>
          </ol>
        </nav>
        <Eyebrow className="mt-12">{crumb}</Eyebrow>
        <h1 className="display-1 mt-6 max-w-4xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted sm:text-xl">{intro}</p>
      </div>
      {image && (
        <div className="container pb-4">
          <div className="bracket">
            <div className="relative aspect-[16/9] overflow-hidden sm:aspect-[21/8]">
              <Image src={image} alt="" fill priority sizes="(min-width: 1360px) 1256px, 100vw" className="object-cover" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
