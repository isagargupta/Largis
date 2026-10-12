import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { ActivityList } from "@/components/portal/ActivityList";
import { ClientSettingsForm } from "@/components/portal/ClientSettingsForm";
import { LeadsManager } from "@/components/portal/LeadsManager";
import { TeamManager } from "@/components/portal/TeamManager";
import { PageHeader, Panel, Stat, StatGrid } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { displayName, formatCents, formatDate } from "@/lib/portal/format";
import { portalHref, portalUrl } from "@/lib/portal/hosts";
import { openStages, orgStatusMeta, stageOrder, staffPermissions } from "@/lib/portal/meta";
import { loadTeam } from "@/lib/portal/queries";
import { getProfiles, getUser, requestHost } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage, OrgStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Client" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "team", label: "Members" },
  { id: "leads", label: "Leads" },
  { id: "activity", label: "Activity" },
] as const;
type Tab = (typeof tabs)[number]["id"];

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string; stage?: string };
}) {
  if (!UUID.test(params.id)) notFound();
  const tab: Tab = tabs.some((t) => t.id === searchParams.tab) ? (searchParams.tab as Tab) : "overview";

  const supabase = createClient();
  const [{ data: org }, user] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, plan, region, status, created_at")
      .eq("id", params.id)
      .maybeSingle(),
    getUser(),
  ]);
  if (!org || !user) notFound();

  const status = orgStatusMeta[org.status];
  const base = portalHref(`/staff/clients/${org.id}`);

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
          <li aria-current="page" className="min-w-0 truncate text-ink">
            {org.name}
          </li>
        </ol>
      </nav>

      <PageHeader
        title={org.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {org.plan && <span>{org.plan} plan</span>}
            {org.region && <span className="font-mono text-xs">{org.region}</span>}
            <span className="font-mono text-xs text-ink-subtle">{org.slug}</span>
          </span>
        }
      />

      <nav aria-label="Client sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-line">
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <li key={t.id}>
                <Link
                  href={t.id === "overview" ? base : `${base}?tab=${t.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px block border-b-2 px-3 py-2.5 text-sm transition-colors",
                    active ? "border-gold-500 text-ink" : "border-transparent text-ink-muted hover:text-ink",
                  )}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "overview" && <Overview org={org} />}
      {tab === "team" && <Members organizationId={org.id} userId={user.id} />}
      {tab === "leads" && (
        <Leads organizationId={org.id} slug={org.slug} userId={user.id} stage={searchParams.stage} />
      )}
      {tab === "activity" && <Activity organizationId={org.id} limit={60} />}
    </div>
  );
}

async function Overview({
  org,
}: {
  org: { id: string; name: string; plan: string | null; region: string | null; status: OrgStatus; created_at: string };
}) {
  const supabase = createClient();
  const [{ data: leads }, { count: members }, { count: invites }] = await Promise.all([
    supabase.from("leads").select("stage, value_cents").eq("organization_id", org.id).limit(1000),
    supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("organization_id", org.id),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .is("accepted_at", null)
      .is("revoked_at", null),
  ]);
  const open = (leads ?? []).filter((l) => openStages.includes(l.stage));
  const openValue = open.reduce((sum, l) => sum + l.value_cents, 0);

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat label="Members" value={(members ?? 0).toLocaleString("en-US")} />
        <Stat label="Pending invitations" value={(invites ?? 0).toLocaleString("en-US")} />
        <Stat label="Open leads" value={open.length.toLocaleString("en-US")} />
        <Stat label="Open pipeline value" value={formatCents(openValue)} />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Panel
          title="Client details"
          actions={<span className="text-xs text-ink-subtle">Client since {formatDate(org.created_at)}</span>}
          bodyClassName="p-4 sm:p-5"
        >
          <ClientSettingsForm
            client={{ id: org.id, name: org.name, plan: org.plan, region: org.region, status: org.status }}
          />
        </Panel>
        <Panel title="Recent activity">
          <Activity organizationId={org.id} limit={8} bare />
        </Panel>
      </div>
    </div>
  );
}

async function Members({ organizationId, userId }: { organizationId: string; userId: string }) {
  const { members, invitations } = await loadTeam(organizationId, userId, true);
  const portal = portalUrl("app", "/login", requestHost());
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Members sign in at{" "}
        <a href={portal} className="inline-flex items-center gap-1 text-brand-700 underline-offset-4 hover:underline">
          {portal.replace(/^https?:\/\//, "")}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        . As Largis staff you can invite, change, or remove anyone, including owners.
      </p>
      <TeamManager
        organizationId={organizationId}
        members={members}
        invitations={invitations}
        canManage
        canGrantOwner
      />
    </div>
  );
}

async function Leads({
  organizationId,
  slug,
  userId,
  stage,
}: {
  organizationId: string;
  slug: string;
  userId: string;
  stage?: string;
}) {
  const supabase = createClient();
  const [{ data: leads, error }, { data: memberships }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, company, contact_name, contact_email, stage, value_cents, owner_id, source, notes, updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase.from("memberships").select("user_id").eq("organization_id", organizationId),
  ]);
  const profiles = await getProfiles((memberships ?? []).map((m) => m.user_id));
  const members = (memberships ?? [])
    .map((m) => ({ id: m.user_id, name: displayName(profiles.get(m.user_id)) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (error) {
    return (
      <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
        Leads could not be loaded. Please refresh the page.
      </p>
    );
  }

  return (
    <LeadsManager
      organizationId={organizationId}
      exportName={slug}
      leads={leads ?? []}
      members={members}
      perms={staffPermissions}
      currentUserId={userId}
      initialStage={stageOrder.includes(stage as LeadStage) ? (stage as LeadStage) : "all"}
    />
  );
}

async function Activity({ organizationId, limit, bare = false }: { organizationId: string; limit: number; bare?: boolean }) {
  const { data } = await createClient()
    .from("activity_log")
    .select("id, action, actor_id, metadata, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const items = data ?? [];
  const profiles = await getProfiles(items.map((a) => a.actor_id));
  const list = <ActivityList items={items} profiles={profiles} />;
  return bare ? list : <Panel title="Activity">{list}</Panel>;
}
