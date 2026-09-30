import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SocialIcon } from "@/components/SocialIcon";
import { legalNav, siteConfig, socialLinks } from "@/lib/site";

const columns = [
  {
    title: "Services",
    links: [
      { label: "Backend & wholesale systems", href: "/services#backend" },
      { label: "Customer support operations", href: "/services#support" },
      { label: "How an engagement works", href: "/services#process" },
    ],
  },
  {
    title: "Software & Security",
    links: [
      { label: "Sales Tracker", href: "/software" },
      { label: "Client portal preview", href: "/app/sales-tracker" },
      { label: "Security & Compliance", href: "/security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/company" },
      { label: "Contact us", href: "/contact" },
      { label: "Client sign in", href: "/login" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="overflow-hidden border-t border-white/10 bg-gradient-to-b from-night-700 via-night to-black text-white">
      <div className="container pt-16">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo />
            <p className="mt-8 text-[15px] font-medium">{siteConfig.legalName}</p>
            <address className="mt-3 max-w-xs text-sm not-italic leading-relaxed text-white/60">
              {siteConfig.address}
            </address>
            <a
              href={`mailto:${siteConfig.email}`}
              className="mt-3 inline-block text-sm text-gold-300 underline-offset-4 hover:text-gold-200 hover:underline"
            >
              {siteConfig.email}
            </a>
            <ul className="mt-6 flex gap-3">
              {socialLinks.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Largis Venture on ${s.label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:text-white"
                  >
                    <SocialIcon icon={s.icon} className="h-[18px] w-[18px]" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Footer" className="grid gap-10 sm:grid-cols-3 lg:col-span-8">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-white/45">{col.title}</p>
                <ul className="mt-5 space-y-3.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-white/80 hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-white/15 pt-8 text-[13px] lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-white/80">© 2026 Largis Venture. All rights reserved.</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {legalNav.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <dl className="flex flex-col gap-1 font-mono text-xs text-white/55 sm:flex-row sm:gap-6 lg:text-right">
            <div>
              <dt className="sr-only">Corporate Identification Number</dt>
              <dd>CIN: {siteConfig.cin}</dd>
            </div>
            <div>
              <dt className="sr-only">GST Identification Number</dt>
              <dd>GSTIN: {siteConfig.gstin}</dd>
            </div>
          </dl>
        </div>

        <p
          aria-hidden="true"
          className="mt-10 select-none text-center text-[22vw] font-bold leading-[0.72] tracking-[-0.06em] text-white/[0.04] 2xl:text-[300px]"
        >
          Largis
        </p>
      </div>
    </footer>
  );
}
