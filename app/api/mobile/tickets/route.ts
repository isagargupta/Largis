import { getURLFromRedirectError, isRedirectError } from "next/dist/client/components/redirect";
import { mobileError, mobileJson, readJson, requireMobileUser, toFormData } from "@/lib/mobile/api";
import { idleState } from "@/lib/portal/action-state";
import { createTicket } from "@/lib/portal/actions/support";

export async function POST(request: Request) {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;

  const body = await readJson(request);
  if (!body) return mobileError(400, "Invalid request body.", "invalid");

  try {
    const state = await createTicket(
      idleState,
      toFormData({
        organizationId: body.organizationId,
        subject: body.subject,
        description: body.description,
        priority: body.priority ?? "normal",
        attachments: JSON.stringify(Array.isArray(body.attachments) ? body.attachments : []),
      }),
    );
    return mobileJson({ ok: false, error: state.message ?? "The ticket could not be opened.", fieldErrors: state.fieldErrors }, 400);
  } catch (err) {
    // On success the action redirects to the new ticket; its id is the last path segment.
    if (isRedirectError(err)) {
      const id = getURLFromRedirectError(err).split("?")[0].split("/").pop();
      return mobileJson({ ok: true, id });
    }
    throw err;
  }
}
