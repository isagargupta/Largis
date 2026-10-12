import type { Metadata } from "next";
import { SecuritySettings } from "@/components/portal/SecuritySettings";
import { PageHeader } from "@/components/portal/ui";
import { getMfaState, getStaffMember, getStaffMfaRequired } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Account security" };

export default async function StaffSecurityPage() {
  const [mfa, staff, required] = await Promise.all([getMfaState(), getStaffMember(), getStaffMfaRequired()]);
  if (!mfa || !staff) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Account security"
        description={<span className="break-all">Signed in as {mfa.user.email}</span>}
      />
      <SecuritySettings
        factors={mfa.factors.map((f) => ({ id: f.id, name: f.friendly_name || "Authenticator app", createdAt: f.created_at }))}
        requiredBy={required ? "Largis" : null}
        staffSetting={staff.role === "admin" ? { requireStaffMfa: required } : undefined}
      />
    </div>
  );
}
