import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { openStages, orgStatusMeta } from "@/lib/portal/meta";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const supabase = createClient();
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, slug, plan, region, status, created_at")
    .order("name");

  const rows = await Promise.all(
    (orgs ?? []).map(async (org) => {
      const [members, leads, open] = await Promise.all([
        supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("organization_id", org.id),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .in("stage", openStages),
      ]);
      return { ...org, members: members.count ?? 0, leads: leads.count ?? 0, openLeads: open.count ?? 0 };
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clients"
        title="Client organisations"
        description="Each client signs in to its own isolated workspace on the client portal. Open one to manage its people and pipeline."
        actions={
          <ButtonLink href={portalHref("/staff/clients/new")} size="sm">
            <Plus className="h-4 w-4" />
            Add client
          </ButtonLink>
        }
      />

      <Panel title={`${rows.length.toLocaleString("en-US")} ${rows.length === 1 ? "client" : "clients"}`}>
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            Clients could not be loaded. Please refresh the page.
          </p>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Building2 className="h-5 w-5" />} title="No clients yet">
            Add your first client to create their portal and invite its owner.
          </EmptyState>
        ) : (
          <>
            <div
              className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_repeat(3,minmax(0,0.6fr))] gap-6 border-b border-line bg-paper-soft px-5 py-2.5 text-xs text-ink-subtle md:grid"
              aria-hidden="true"
            >
              <span>Client</span>
              <span>Plan · region</span>
              <span className="text-right">Members</span>
              <span className="text-right">Open leads</span>
              <span className="text-right">Status</span>
            </div>
            <ul className="divide-y divide-line">
              {rows.map((org) => {
                const status = orgStatusMeta[org.status];
                return (
                  <li key={org.id}>
                    <Link
                      href={portalHref(`/staff/clients/${org.id}`)}
                      className="grid gap-2 px-4 py-3.5 hover:bg-paper-soft/70 sm:px-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_repeat(3,minmax(0,0.6fr))] md:items-center md:gap-6"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{org.name}</span>
                        <span className="block truncate font-mono text-[11px] text-ink-subtle">
                          {org.slug} · since {formatDate(org.created_at)}
                        </span>
                      </span>
                      <span className="min-w-0 truncate text-xs text-ink-muted">
                        {[org.plan, org.region].filter(Boolean).join(" · ") || "—"}
                      </span>
                      <span className="text-xs text-ink-muted md:text-right md:text-sm md:tabular-nums">
                        <span className="md:hidden">Members: </span>
                        {org.members}
                      </span>
                      <span className="text-xs text-ink-muted md:text-right md:text-sm md:tabular-nums">
                        <span className="md:hidden">Open leads: </span>
                        {org.openLeads}
                        <span className="text-ink-subtle"> / {org.leads}</span>
                      </span>
                      <span className="md:text-right">
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
