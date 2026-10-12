"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { OrgSwitcher, type SwitcherOrg } from "@/components/sales-tracker/OrgSwitcher";
import { switchOrganization } from "@/lib/portal/actions/session";

export function ActiveOrgSwitcher({
  organizations,
  activeId,
  tone = "dark",
}: {
  organizations: SwitcherOrg[];
  activeId: string;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <OrgSwitcher
      organizations={organizations}
      activeId={activeId}
      tone={tone}
      showIds={false}
      disabled={pending}
      onChange={(id) => {
        if (id === activeId) return;
        startTransition(async () => {
          await switchOrganization(id);
          router.refresh();
        });
      }}
    />
  );
}
