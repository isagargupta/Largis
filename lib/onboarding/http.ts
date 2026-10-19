import { isOnboardingSlot, type OnboardingSlot } from "@/lib/onboarding/files";

export function crossSite(request: Request) {
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0]?.trim();
  if (!origin || !host) return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function readUpload(request: Request): Promise<{ slot: OnboardingSlot; file: File } | { error: string }> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { error: "That file could not be read." };
  }
  const slot = form.get("slot");
  const file = form.get("file");
  if (!isOnboardingSlot(slot) || !(file instanceof File)) return { error: "Choose a document to upload." };
  return { slot, file };
}
