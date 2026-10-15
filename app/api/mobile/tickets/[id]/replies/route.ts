import { readJson, requireMobileUser, runAction } from "@/lib/mobile/api";
import { replyToTicket } from "@/lib/portal/actions/support";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;

  const body = await readJson(request);
  return runAction(replyToTicket, {
    ticketId: params.id,
    body: body?.body,
    internal: false,
    attachments: JSON.stringify(Array.isArray(body?.attachments) ? body.attachments : []),
  });
}
