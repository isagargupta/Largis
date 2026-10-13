import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, Lock } from "lucide-react";
import { ActiveOrgSwitcher } from "@/components/portal/ActiveOrgSwitcher";
import { PortalShell, type NavItem } from "@/components/portal/PortalShell";
import { EmptyState } from "@/components/portal/ui";
import { UserMenu } from "@/components/portal/UserMenu";
import { loadChatUnread } from "@/lib/portal/chat";
import { displayName } from "@/lib/portal/format";
import { marketingOrigin, portalHref, portalUrl } from "@/lib/portal/hosts";
import { rolePermissions } from "@/lib/portal/meta";
import {
  getClientContext,
  getClientMfaRequirement,
  getMfaState,
  getProfiles,
  getStaffMember,
  requestHost,
  requestPath,
  requireUser,
} from "@/lib/portal/session";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "Client portal", template: `%s | Client portal | ${siteConfig.name}` },
  robots: { index: false, follow: false },
};

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app");
  const host = requestHost();
  const [ctx, staff, profiles] = await Promise.all([getClientContext(), getStaffMember(), getProfiles([user.id])]);
  if (!ctx) redirect("/login");
  if (!ctx.orgs.length && staff) redirect(portalUrl("staff", "/staff", host));

  const path = requestPath();
  const securityPath = portalHref("/app/account/security");
  const [mfa, requiredBy] = await Promise.all([getMfaState(), getClientMfaRequirement()]);
  if (mfa?.needsChallenge) redirect(`/login?next=${encodeURIComponent(path || "/")}`);
  const mustEnroll = requiredBy.length > 0 && !mfa?.factors.length;
  if (mustEnroll && path !== securityPath) redirect(securityPath);

  const active = ctx.active;
  const perms = active ? rolePermissions[active.role] : null;
  const messagesPath = portalHref("/app/messages");
  const [{ count: awaitingReply }, chatUnread] = active
    ? await Promise.all([
        createClient()
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", active.id)
          .eq("status", "pending_client"),
        loadChatUnread(),
      ])
    : [{ count: 0 }, new Map<string, number>()];
  const unreadMessages = active && path !== messagesPath ? chatUnread.get(active.id) ?? 0 : 0;

  const nav: NavItem[] = mustEnroll
    ? [{ href: securityPath, label: "Account security", icon: "security" }]
    : [
        { href: portalHref("/app"), label: "Overview", icon: "overview" },
        { href: portalHref("/app/sales-tracker"), label: "Sales Tracker", icon: "sales" },
        { href: messagesPath, label: "Messages", icon: "messages", count: unreadMessages },
        { href: portalHref("/app/support"), label: "Support", icon: "support", count: awaitingReply ?? 0 },
        { href: portalHref("/app/reports"), label: "Reports", icon: "reports" },
        ...(perms?.canViewBilling ? [{ href: portalHref("/app/billing"), label: "Billing", icon: "billing" as const }] : []),
        { href: portalHref("/app/team"), label: "Team", icon: "team" },
      ];
  const switcher =
    ctx.orgs.length > 1 && active ? (
      <ActiveOrgSwitcher
        organizations={ctx.orgs.map((o) => ({ id: o.id, name: o.name, region: o.region, plan: o.plan }))}
        activeId={active.id}
      />
    ) : null;

  return (
    <PortalShell
      variant="client"
      root={portalHref("/app")}
      label="Client portal"
      nav={nav}
      headerSlot={switcher}
      drawerSlot={
        switcher && (
          <ActiveOrgSwitcher
            organizations={ctx.orgs.map((o) => ({ id: o.id, name: o.name, region: o.region, plan: o.plan }))}
            activeId={active!.id}
            tone="light"
          />
        )
      }
      userMenu={
        <UserMenu
          name={profiles.get(user.id)?.full_name ?? ""}
          email={user.email ?? displayName(profiles.get(user.id))}
          roleLabel={active && perms ? `${perms.label} · ${active.name}` : undefined}
          links={[
            { label: "Account security", href: securityPath },
            ...(staff ? [{ label: "Largis Workspace", href: portalUrl("staff", "/staff", host) }] : []),
            { label: "Largis website", href: marketingOrigin(siteConfig.url, host) },
          ]}
        />
      }
      sidebarFooter={
        perms && (
          <div className="border-t border-line px-3 pt-5">
            <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <Lock className="h-3.5 w-3.5" />
              Your access
            </p>
            <p className="mt-2 text-[15px]">{perms.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{perms.scope}</p>
          </div>
        )
      }
    >
      {active || path === securityPath ? (
        children
      ) : (
        <div className="mx-auto max-w-xl border border-line bg-white">
          <EmptyState icon={<Building2 className="h-5 w-5" />} title="Your account isn't linked to an organization yet">
            Contact your Largis account manager and they will add you. If you were invited recently, sign out and sign in
            again with the invited email address. Questions:{" "}
            <a href={`mailto:${siteConfig.email}`} className="text-brand-700 underline underline-offset-4">
              {siteConfig.email}
            </a>
            .
          </EmptyState>
        </div>
      )}
    </PortalShell>
  );
}
