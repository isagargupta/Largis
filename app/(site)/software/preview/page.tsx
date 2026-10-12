import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SalesTrackerDashboard } from "@/components/sales-tracker/SalesTrackerDashboard";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sales Tracker Preview",
  description:
    "Preview the Largis Venture Sales Tracker with sample data: revenue, lead pipeline, and role-based access for each client organisation.",
  alternates: { canonical: "/software/preview" },
};

export default function SalesTrackerPreviewPage() {
  return (
    <div className="bg-paper">
      <div className="container pb-24 pt-10">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-sm text-ink-subtle">
            <li>
              <Link href="/software" className="hover:text-ink">
                Software Suite
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="text-ink">
              Sales Tracker preview
            </li>
          </ol>
        </nav>

        <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>Preview with sample data</Eyebrow>
            <h1 className="display-2 mt-5">Sales Tracker</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-muted">
              Every company, figure, and person below is sample data. Switch organisation or role to see how access
              changes what each person can see in the client portal.
            </p>
          </div>
          <ButtonLink href="/contact?interest=Sales%20Tracking%20Software" className="self-start md:self-auto">
            Request a full demo
          </ButtonLink>
        </div>

        <div className="mt-10">
          <SalesTrackerDashboard />
        </div>
      </div>
    </div>
  );
}
