import type { Metadata } from "next";
import { SecuritySettings } from "@/components/portal/SecuritySettings";
import { PageHeader } from "@/components/portal/ui";
import { getClientMfaRequirement, getMfaState } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Account security" };

export default async function ClientSecurityPage() {
  const [mfa, requiredBy] = await Promise.all([getMfaState(), getClientMfaRequirement()]);
  if (!mfa) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Account security"
        description={<span className="break-all">Signed in as {mfa.user.email}</span>}
      />
      <SecuritySettings
        factors={mfa.factors.map((f) => ({ id: f.id, name: f.friendly_name || "Authenticator app", createdAt: f.created_at }))}
        requiredBy={requiredBy.length ? requiredBy.join(", ") : null}
      />
    </div>
  );
}
