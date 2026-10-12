import { History } from "lucide-react";
import { EmptyState } from "@/components/portal/ui";
import { describeActivity, displayName, formatDateTime, type Profile } from "@/lib/portal/format";

export type ActivityItem = {
  id: string;
  action: string;
  actor_id: string | null;
  metadata: unknown;
  created_at: string;
  organizationName?: string | null;
};

export function ActivityList({
  items,
  profiles,
  unknownActor = "Largis team",
}: {
  items: ActivityItem[];
  profiles: Map<string, Profile>;
  unknownActor?: string;
}) {
  if (!items.length) {
    return (
      <EmptyState icon={<History className="h-5 w-5" />} title="No activity yet">
        Changes to leads, members, and invitations will appear here.
      </EmptyState>
    );
  }

  return (
    <ol className="divide-y divide-line">
      {items.map((item) => {
        const actor = item.actor_id ? displayName(profiles.get(item.actor_id), unknownActor) : "System";
        return (
          <li key={item.id} className="flex gap-3 px-4 py-3 sm:px-5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-gold-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm">
                <span className="font-medium">{actor}</span> {describeActivity(item)}
              </p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {formatDateTime(item.created_at)}
                {item.organizationName && <> · {item.organizationName}</>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
