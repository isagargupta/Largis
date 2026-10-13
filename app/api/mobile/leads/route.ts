import { mobileError, readJson, requireMobileUser, runAction } from "@/lib/mobile/api";
import { createLead } from "@/lib/portal/actions/leads";

export async function POST(request: Request) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;

  const body = await readJson(request);
  if (!body) return mobileError(400, "Invalid request body.", "invalid");
  return runAction(createLead, body);
}
