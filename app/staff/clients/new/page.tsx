import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ClientCreateForm, type ClientPrefill } from "@/components/portal/ClientCreateForm";
import { PageHeader, Panel } from "@/components/portal/ui";
import { portalHref } from "@/lib/portal/hosts";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Add client" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewClientPage({ searchParams }: { searchParams: { enquiry?: string } }) {
  let prefill: ClientPrefill = { name: "", ownerEmail: "", ownerName: "", enquiryId: null };

  if (typeof searchParams.enquiry === "string" && UUID.test(searchParams.enquiry)) {
    const { data } = await createClient()
      .from("contact_submissions")
      .select("id, name, email, company")
      .eq("id", searchParams.enquiry)
      .maybeSingle();
    if (data) prefill = { name: data.company, ownerEmail: data.email, ownerName: data.name, enquiryId: data.id };
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-ink-subtle">
          <li>
            <Link href={portalHref("/staff/clients")} className="hover:text-ink">
              Clients
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li aria-current="page" className="text-ink">
            Add client
          </li>
        </ol>
      </nav>

      <PageHeader
        title="Add a client"
        description={
          prefill.enquiryId
            ? `Converting the enquiry from ${prefill.ownerName}. The enquiry is closed once the client is created.`
            : "Creates the client's organisation and invites its owner to the client portal."
        }
      />

      <Panel className="max-w-3xl" bodyClassName="p-4 sm:p-6">
        <ClientCreateForm prefill={prefill} />
      </Panel>
    </div>
  );
}
