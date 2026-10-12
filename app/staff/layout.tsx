import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PortalShell, type NavItem } from "@/components/portal/PortalShell";
import { UserMenu } from "@/components/portal/UserMenu";
import { displayName } from "@/lib/portal/format";
import { marketingOrigin, portalHref, portalUrl } from "@/lib/portal/hosts";
import { staffRoleLabel, staffRoleScope } from "@/lib/portal/meta";
import { getProfiles, hasClientMembership, requestHost, requireStaff } from "@/lib/portal/session";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "Largis Workspace", template: "%s | Largis Workspace" },
  robots: { index: false, follow: false },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, staff } = await requireStaff();
  const host = requestHost();
  const [profiles, isClient, { count: newEnquiries }] = await Promise.all([
    getProfiles([user.id]),
    hasClientMembership(user.id),
    createClient().from("contact_submissions").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  const profile = profiles.get(user.id);

  const nav: NavItem[] = [
    { href: portalHref("/staff"), label: "Dashboard", icon: "overview" },
    { href: portalHref("/staff/enquiries"), label: "Enquiries", icon: "enquiries", count: newEnquiries ?? 0 },
    { href: portalHref("/staff/clients"), label: "Clients", icon: "clients" },
    { href: portalHref("/staff/team"), label: "Team", icon: "team" },
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
