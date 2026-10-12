import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/portal/filters";
import { SlaDetails } from "@/components/portal/SlaBadge";
import { TicketReplyForm, TicketStatusButton } from "@/components/portal/SupportForms";
import { TicketThread } from "@/components/portal/TicketViews";
import { PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { ticketChannelLabel, ticketPriorityMeta, ticketStatusMeta } from "@/lib/portal/meta";
import { isUuid } from "@/lib/portal/params";
import { loadPeopleNames } from "@/lib/portal/queries";
import { getOrgAccess } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ticket" };

export default async function ClientTicketPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();

  const supabase = createClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
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
      .eq("internal", false)
      .order("created_at", { ascending: true }),
  ]);
  if (!ticket) notFound();

  const access = await getOrgAccess(ticket.organization_id);
  if (!access) notFound();

  const thread = messages ?? [];
  const names = await loadPeopleNames([ticket.created_by, ticket.assigned_to, ...thread.map((m) => m.author_id)]);
  const status = ticketStatusMeta[ticket.status];
  const priority = ticketPriorityMeta[ticket.priority];
  const now = Date.now();
  const opener = (ticket.created_by && names.get(ticket.created_by)) || ticket.requester_name || ticket.requester_email || "Requester";

  const details: [string, React.ReactNode][] = [
    ["Reference", <span key="ref" className="font-mono">{ticket.reference}</span>],
    ["Status", status.clientLabel],
    ["Priority", priority.label],
    ["Opened by", opener],
    ["Assigned to", ticket.assigned_to ? names.get(ticket.assigned_to) ?? "Largis team" : "Not yet assigned"],
    ["Opened", formatDateTime(ticket.created_at)],
    ["Last updated", formatDateTime(ticket.updated_at)],
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Support", href: portalHref("/app/support") }, { label: ticket.reference }]} />

      <PageHeader
        title={ticket.subject}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-xs">{ticket.reference}</span>
            <Badge tone={status.tone}>{status.clientLabel}</Badge>
            <Badge tone={priority.tone}>{priority.label} priority</Badge>
          </span>
        }
        actions={access.perms.canEdit ? <TicketStatusButton ticketId={ticket.id} status={ticket.status} /> : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="min-w-0 space-y-6">
          <Panel title="Conversation" bodyClassName="p-4 sm:p-5">
            <TicketThread
              audience="client"
              opening={{
                authorName: opener,
                body: ticket.description,
                createdAt: ticket.created_at,
                channel: ticketChannelLabel[ticket.channel].toLowerCase(),
              }}
              messages={thread.map((m) => ({
                id: m.id,
                authorName: (m.author_id && names.get(m.author_id)) || (m.author_kind === "staff" ? "Largis team" : "Former member"),
                authorKind: m.author_kind,
                body: m.body,
                internal: false,
                createdAt: m.created_at,
              }))}
            />
          </Panel>

          {access.perms.canEdit ? (
            <Panel title="Reply" bodyClassName="p-4 sm:p-5">
              <TicketReplyForm ticketId={ticket.id} status={ticket.status} />
            </Panel>
          ) : (
            <p className="border border-line bg-white px-4 py-3 text-sm text-ink-muted">
              Your role can read tickets but not reply. Ask an owner or admin if you need to respond.
            </p>
          )}
        </div>

        <div className="space-y-6">
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
          <Panel title="Service levels" bodyClassName="px-4 sm:px-5">
            <SlaDetails ticket={ticket} now={now} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
