import { mobileError, readJson, requireMobileUser, runAction } from "@/lib/mobile/api";
import { isReviewEmail } from "@/lib/mobile/review";
import { changeMemberRole, removeMember } from "@/lib/portal/actions/team";

function demoBlocked(email: string | undefined) {
  return email && isReviewEmail(email) ? mobileError(403, "Team changes are turned off for the demo account.", "forbidden") : null;
}

export async function PATCH(request: Request, { params }: { params: { userId: string } }) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;
  const blocked = demoBlocked(gate.user.email);
  if (blocked) return blocked;

  const body = await readJson(request);
  if (!body) return mobileError(400, "Invalid request body.", "invalid");
  return runAction(changeMemberRole, { organizationId: body.organizationId, userId: params.userId, role: body.role });
}

export async function DELETE(request: Request, { params }: { params: { userId: string } }) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;
  const blocked = demoBlocked(gate.user.email);
  if (blocked) return blocked;

  const organizationId = new URL(request.url).searchParams.get("organizationId");
  return runAction(removeMember, { organizationId, userId: params.userId });
}
