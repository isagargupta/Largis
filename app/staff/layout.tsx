import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PortalShell, type NavItem } from "@/components/portal/PortalShell";
import { UserMenu } from "@/components/portal/UserMenu";
import { displayName } from "@/lib/portal/format";
import { marketingOrigin, portalHref, portalUrl } from "@/lib/portal/hosts";
import { activeTicketStatuses, staffRoleLabel, staffRoleScope } from "@/lib/portal/meta";
import { billingToday } from "@/lib/portal/billing";
import { loadChatUnread } from "@/lib/portal/chat";
import {
  getMfaState,
  getProfiles,
  getStaffMfaRequired,
  hasClientMembership,
  requestHost,
  requestPath,
  requireStaff,
} from "@/lib/portal/session";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "Largis Workspace", template: "%s | Largis Workspace" },
  robots: { index: false, follow: false },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, staff } = await requireStaff();
  const host = requestHost();
  const path = requestPath();
  const securityPath = portalHref("/staff/account/security");

  const [mfa, mfaRequired] = await Promise.all([getMfaState(), getStaffMfaRequired()]);
  if (mfa?.needsChallenge) redirect(`/login?next=${encodeURIComponent(path || "/")}`);
  const mustEnroll = mfaRequired && !mfa?.factors.length;
  if (mustEnroll && path !== securityPath) redirect(securityPath);

  const supabase = createClient();
  const [profiles, isClient, chatUnread, { count: newEnquiries }, { count: unassignedTickets }, { count: overdueInvoices }] = await Promise.all([
    getProfiles([user.id]),
    hasClientMembership(user.id),
    loadChatUnread(),
    supabase.from("contact_submissions").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", activeTicketStatuses)
      .is("assigned_to", null),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .or(`status.eq.overdue,and(status.eq.issued,due_date.lt.${billingToday()})`),
  ]);
  const profile = profiles.get(user.id);
  const unreadConversations = Array.from(chatUnread.values()).filter((n) => n > 0).length;

  const nav: NavItem[] = mustEnroll
    ? [{ href: securityPath, label: "Account security", icon: "security" }]
    : [
        { href: portalHref("/staff"), label: "Dashboard", icon: "overview" },
        { href: portalHref("/staff/messages"), label: "Messages", icon: "messages", count: unreadConversations },
        { href: portalHref("/staff/support"), label: "Support", icon: "support", count: unassignedTickets ?? 0 },
        { href: portalHref("/staff/delivery"), label: "Delivery", icon: "delivery" },
        { href: portalHref("/staff/billing"), label: "Billing", icon: "billing", count: overdueInvoices ?? 0 },
        { href: portalHref("/staff/enquiries"), label: "Enquiries", icon: "enquiries", count: newEnquiries ?? 0 },
        { href: portalHref("/staff/clients"), label: "Clients", icon: "clients" },
        { href: portalHref("/staff/team"), label: "Team", icon: "team" },
        ...(staff.role === "admin" ? [{ href: portalHref("/staff/audit"), label: "Audit log", icon: "audit" as const }] : []),
      ];

  return (
    <PortalShell
      variant="staff"
      root={portalHref("/staff")}
      label="Largis Workspace"
      nav={nav}
      userMenu={
        <UserMenu
          tone="light"
          name={profile?.full_name ?? ""}
          email={user.email ?? displayName(profile)}
          roleLabel={`${staffRoleLabel[staff.role]}${staff.title ? ` · ${staff.title}` : ""}`}
          links={[
            { label: "Account security", href: securityPath },
            ...(isClient ? [{ label: "Client portal", href: portalUrl("app", "/app", host) }] : []),
            { label: "Largis website", href: marketingOrigin(siteConfig.url, host) },
          ]}
        />
      }
      sidebarFooter={
        <div className="border-t border-white/10 px-3 pt-5">
          <p className="flex items-center gap-1.5 text-xs text-white/50">
            <ShieldCheck className="h-3.5 w-3.5" />
            Staff access
          </p>
          <p className="mt-2 text-[15px] text-white">{staffRoleLabel[staff.role]}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">{staffRoleScope[staff.role]}</p>
        </div>
      }
    >
      {children}
    </PortalShell>
  );
}
