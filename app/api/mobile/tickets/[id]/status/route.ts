import { readJson, requireMobileUser, runAction } from "@/lib/mobile/api";
import { setTicketStatus } from "@/lib/portal/actions/support";

/** Clients can mark a ticket resolved or reopen it. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;

  const body = await readJson(request);
  return runAction(setTicketStatus, { id: params.id, status: body?.status });
}
