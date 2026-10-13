import { mobileError, readJson, requireMobileUser, runAction } from "@/lib/mobile/api";
import { deleteLead, updateLead } from "@/lib/portal/actions/leads";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;

  const body = await readJson(request);
  if (!body) return mobileError(400, "Invalid request body.", "invalid");
  return runAction(updateLead, { ...body, id: params.id });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;

  const organizationId = new URL(request.url).searchParams.get("organizationId");
  return runAction(deleteLead, { id: params.id, organizationId });
}
