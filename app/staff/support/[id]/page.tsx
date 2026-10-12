import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { ActivityList } from "@/components/portal/ActivityList";
import { Breadcrumb } from "@/components/portal/filters";
import { SlaDetails } from "@/components/portal/SlaBadge";
import { TicketControls, TicketReplyForm } from "@/components/portal/SupportForms";
import { TicketThread } from "@/components/portal/TicketViews";
import { PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { displayName, formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { ticketChannelLabel, ticketPriorityMeta, ticketStatusMeta } from "@/lib/portal/meta";
import { isUuid } from "@/lib/portal/params";
import { loadStaffOptions } from "@/lib/portal/queries";
import { getProfiles } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ticket" };

export default async function StaffTicketPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();

  const supabase = createClient();
  const [{ data: ticket }, { data: messages }, { data: history }, staff] = await Promise.all([
    supabase
      .from("support_tickets")
      .select(
        "id, organization_id, reference, subject, description, priority, status, channel, requester_name, requester_email, created_by, assigned_to, created_at, updated_at, first_response_at, resolved_at, sla_first_response_minutes, sla_resolution_minutes",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("ticket_messages")
      .select("id, author_id, author_kind, body, internal, created_at")
      .eq("ticket_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("activity_log")
      .select("id, action, actor_id, metadata, created_at")
      .eq("entity", "ticket")
      .eq("entity_id", params.id)
      .order("created_at", { ascending: false })
      .limit(30),
    loadStaffOptions(),
  ]);
  if (!ticket) notFound();

  const thread = messages ?? [];
  const events = history ?? [];
  const [{ data: org }, profiles] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", ticket.organization_id).maybeSingle(),
    getProfiles([ticket.created_by, ticket.assigned_to, ...thread.map((m) => m.author_id), ...events.map((e) => e.actor_id)]),
  ]);

  const status = ticketStatusMeta[ticket.status];
  const priority = ticketPriorityMeta[ticket.priority];
  const now = Date.now();
  const opener =
    (ticket.created_by && profiles.has(ticket.created_by) && displayName(profiles.get(ticket.created_by))) ||
    ticket.requester_name ||
    ticket.requester_email ||
    "Requester";
  const replySubject = encodeURIComponent(`[${ticket.reference}] ${ticket.subject}`);

  const details: [string, React.ReactNode][] = [
    [
      "Client",
      org ? (
        <Link key="org" href={portalHref(`/staff/clients/${org.id}?tab=support`)} className="text-brand-700 underline-offset-4 hover:underline">
          {org.name}
        </Link>
      ) : (
        "—"
      ),
    ],
    ["Requester", ticket.requester_name || "—"],
    [
      "Email",
      ticket.requester_email ? (
        <a key="email" href={`mailto:${ticket.requester_email}`} className="break-all text-brand-700 underline-offset-4 hover:underline">
          {ticket.requester_email}
        </a>
      ) : (
        "—"
      ),
    ],
    ["Channel", ticketChannelLabel[ticket.channel]],
    ["Opened", formatDateTime(ticket.created_at)],
    ["First response", ticket.first_response_at ? formatDateTime(ticket.first_response_at) : "Not yet"],
    ["Resolved", ticket.resolved_at ? formatDateTime(ticket.resolved_at) : "—"],
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Support", href: portalHref("/staff/support") }, { label: ticket.reference }]} />

      <PageHeader
        title={ticket.subject}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-xs">{ticket.reference}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={priority.tone}>{priority.label} priority</Badge>
            {org && <span>{org.name}</span>}
          </span>
        }
        actions={
          ticket.requester_email ? (
            <a href={`mailto:${ticket.requester_email}?subject=${replySubject}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Mail className="h-4 w-4" />
              Email requester
            </a>
          ) : undefined
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0 space-y-6">
          <Panel title="Conversation" bodyClassName="p-4 sm:p-5">
            <TicketThread
              audience="staff"
              opening={{
                authorName: opener,
                body: ticket.description,
                createdAt: ticket.created_at,
                channel: ticketChannelLabel[ticket.channel].toLowerCase(),
              }}
              messages={thread.map((m) => ({
                id: m.id,
                authorName: m.author_id ? displayName(profiles.get(m.author_id), "Former user") : "System",
                authorKind: m.author_kind,
                body: m.body,
                internal: m.internal,
                createdAt: m.created_at,
              }))}
            />
          </Panel>
          <Panel title="Respond" bodyClassName="p-4 sm:p-5">
            <TicketReplyForm ticketId={ticket.id} status={ticket.status} staff />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Triage" bodyClassName="p-4 sm:p-5">
            <TicketControls
              key={`${ticket.status}-${ticket.priority}-${ticket.assigned_to ?? ""}`}
              ticket={{ id: ticket.id, status: ticket.status, priority: ticket.priority, assignedTo: ticket.assigned_to }}
              staff={staff}
            />
          </Panel>
          <Panel title="Service levels" bodyClassName="px-4 sm:px-5">
            <SlaDetails ticket={ticket} now={now} />
          </Panel>
          <Panel title="Details" bodyClassName="p-4 sm:p-5">
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-subtle">{label}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="History">
            <ActivityList items={events} profiles={profiles} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
