import { requireMobileUser, runAction } from "@/lib/mobile/api";
import { revokeInvitation } from "@/lib/portal/actions/team";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;

  return runAction(revokeInvitation, { invitationId: params.id });
}
