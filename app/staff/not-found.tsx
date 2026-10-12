import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/portal/ui";
import { ButtonLink } from "@/components/ui/button";
import { portalHref } from "@/lib/portal/hosts";

export default function StaffNotFound() {
  return (
    <div className="mx-auto max-w-xl border border-line bg-white">
      <EmptyState icon={<SearchX className="h-5 w-5" />} title="That page doesn't exist">
        It may have been removed, or the link is incomplete.
        <div className="mt-6">
          <ButtonLink href={portalHref("/staff")} variant="outline" size="sm">
            Back to the dashboard
          </ButtonLink>
        </div>
      </EmptyState>
    </div>
  );
}
