import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Mail, UserPlus } from "lucide-react";
import { EnquiryEditor } from "@/components/portal/EnquiryEditor";
import { PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { enquiryStatusMeta } from "@/lib/portal/meta";
import { loadStaffDirectory } from "@/lib/portal/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Enquiry" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EnquiryPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();

  const [{ data: enquiry }, directory] = await Promise.all([
    createClient()
      .from("contact_submissions")
      .select("id, name, email, company, interest, message, status, assigned_to, internal_notes, created_at, updated_at")
      .eq("id", params.id)
      .maybeSingle(),
    loadStaffDirectory(),
  ]);
  if (!enquiry) notFound();

  const status = enquiryStatusMeta[enquiry.status];
  const staff = directory.filter((s) => s.active).map((s) => ({ id: s.userId, name: s.name }));
  const replySubject = encodeURIComponent(`Re: Your enquiry to Largis Venture (${enquiry.interest})`);
  const convertHref = `${portalHref("/staff/clients/new")}?enquiry=${enquiry.id}`;

  const details: [string, React.ReactNode][] = [
    ["Name", enquiry.name],
    [
      "Email",
      <a key="email" href={`mailto:${enquiry.email}`} className="break-all text-brand-700 underline-offset-4 hover:underline">
        {enquiry.email}
      </a>,
    ],
    ["Company", enquiry.company],
    ["Interest", enquiry.interest],
    ["Received", formatDateTime(enquiry.created_at)],
    ["Last updated", formatDateTime(enquiry.updated_at)],
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-ink-subtle">
          <li>
            <Link href={portalHref("/staff/enquiries")} className="hover:text-ink">
              Enquiries
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li aria-current="page" className="min-w-0 truncate text-ink">
            {enquiry.company}
          </li>
        </ol>
      </nav>

      <PageHeader
        title={enquiry.company}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>
              From {enquiry.name} · {formatDateTime(enquiry.created_at)}
            </span>
          </span>
        }
        actions={
          <>
            <a href={`mailto:${enquiry.email}?subject=${replySubject}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Mail className="h-4 w-4" />
              Reply by email
            </a>
            <ButtonLink href={convertHref} size="sm">
              <UserPlus className="h-4 w-4" />
              Convert to client
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <Panel title="Enquiry" bodyClassName="p-4 sm:p-5">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[120px_minmax(0,1fr)]">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-subtle">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-6 border-t border-line pt-5 text-sm font-semibold">Message</h3>
          <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-muted">{enquiry.message}</p>
        </Panel>

        <Panel title="Triage" bodyClassName="p-4 sm:p-5">
          <EnquiryEditor
            enquiry={{
              id: enquiry.id,
              status: enquiry.status,
              assignedTo: enquiry.assigned_to,
              internalNotes: enquiry.internal_notes,
            }}
            staff={staff}
          />
        </Panel>
      </div>
    </div>
  );
}
