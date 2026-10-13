import { mobileError, mobileJson, readJson, requireMobileUser } from "@/lib/mobile/api";
import { sendChatMessage } from "@/lib/portal/actions/chat";

export async function POST(request: Request) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;

  const body = await readJson(request);
  const result = await sendChatMessage(String(body?.organizationId ?? ""), String(body?.body ?? ""));
  if (!result.ok) return mobileError(400, result.error);
  return mobileJson({ ok: true, message: result.message });
}
