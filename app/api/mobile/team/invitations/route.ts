import { mobileError, readJson, requireMobileUser, runAction } from "@/lib/mobile/api";
import { isReviewEmail } from "@/lib/mobile/review";
import { inviteMember } from "@/lib/portal/actions/team";

export async function POST(request: Request) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;
  if (gate.user.email && isReviewEmail(gate.user.email)) {
    return mobileError(403, "Invitations are turned off for the demo account.", "forbidden");
  }

  const body = await readJson(request);
  if (!body) return mobileError(400, "Invalid request body.", "invalid");
  return runAction(inviteMember, {
    organizationId: body.organizationId,
    email: body.email,
    fullName: body.fullName,
    role: body.role,
  });
}
