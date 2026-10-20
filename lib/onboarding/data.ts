import "server-only";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ONBOARDING_BUCKET,
  ONBOARDING_MAX_BYTES,
  ONBOARDING_TOKEN,
  documentNames,
  onboardingFileError,
  readDocuments,
  sniffOnboardingFile,
  type OnboardingFile,
} from "@/lib/onboarding/files";
import {
  issuesToFields,
  onboardingSchema,
  requiredSlots,
  submissionColumns,
  type OnboardingSlot,
} from "@/lib/onboarding/schema";
import { friendlyDbError } from "@/lib/portal/action-state";
import { marketingOrigin } from "@/lib/portal/hosts";
import { requestHost } from "@/lib/portal/session";
import { siteConfig } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, OnboardingStatus } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["employee_onboardings"]["Row"];

export function newOnboardingToken() {
  return randomBytes(32).toString("base64url");
}

export function onboardingJoinUrl(token: string) {
  return `${marketingOrigin(siteConfig.url, requestHost())}/join/${token}`;
}

export function onboardingOpen(row: Pick<Row, "status" | "expires_at">, now = Date.now()) {
  return row.status === "open" && new Date(row.expires_at).getTime() > now;
}

function failure(error: string, status: number, fieldErrors?: Record<string, string>) {
  return { ok: false as const, error, status, fieldErrors };
}

async function limited(admin: NonNullable<ReturnType<typeof createAdminClient>>, bucket: string) {
  const { data, error } = await admin.rpc("auth_rate_limit_hit", { p_bucket: bucket, p_window_seconds: 3600, p_max: 80 });
  if (error) {
    console.error("[onboarding] rate limit check failed", error.code);
    return true;
  }
  return data !== false;
}

export async function loadOnboardingByToken(token: string) {
  if (!ONBOARDING_TOKEN.test(token)) return { kind: "invalid" as const };
  const admin = createAdminClient();
  if (!admin) return { kind: "unavailable" as const };
  const { data, error } = await admin.from("employee_onboardings").select("*").eq("token", token).maybeSingle();
  if (error) {
    console.error("[onboarding] lookup failed", error.code);
    return { kind: "unavailable" as const };
  }
  if (!data) return { kind: "invalid" as const };
  if (data.status === "submitted" || data.status === "reviewed") return { kind: "done" as const };
  if (!onboardingOpen(data)) return { kind: "closed" as const };
  return { kind: "open" as const, row: data, files: documentNames(data.documents) };
}

export async function saveOnboardingDocument(
  supabase: Client,
  row: Pick<Row, "id" | "status" | "expires_at" | "documents">,
  slot: OnboardingSlot,
  file: File,
  mode: "public" | "staff",
) {
  if (mode === "public" && !onboardingOpen(row)) return failure("This link is no longer accepting documents.", 410);
  if (mode === "staff" && row.status === "revoked") return failure("This onboarding was revoked.", 409);
  const rejected = onboardingFileError(file);
  if (rejected) return failure(rejected, 422);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > ONBOARDING_MAX_BYTES) return failure("That file is larger than 8 MB.", 413);
  const sniffed = sniffOnboardingFile(bytes);
  if (!sniffed) return failure("That file doesn't look like a PDF or a photo. Upload the original document.", 422);

  if (mode === "public") {
    const admin = createAdminClient();
    if (!admin) return failure("Uploads are temporarily unavailable.", 503);
    const allowed = await limited(admin, `onboarding:${row.id}`);
    if (!allowed) return failure("Too many uploads on this link. Wait a while and try again.", 429);
  }

  const name = (file.name.trim() || `document.${sniffed.ext}`).slice(0, 200);
  const path = `${row.id}/${slot}/${crypto.randomUUID()}.${sniffed.ext}`;
  const record: OnboardingFile = { path, name, type: sniffed.type, size: bytes.byteLength };
  const uploaded = await supabase.storage.from(ONBOARDING_BUCKET).upload(path, bytes, { contentType: sniffed.type, upsert: false });
  if (uploaded.error) {
    console.error("[onboarding] upload failed", uploaded.error.message);
    return failure("That file could not be uploaded. Please try again.", 502);
  }

  const { data: saved, error } = await supabase.rpc("onboarding_set_document", {
    p_id: row.id,
    p_slot: slot,
    p_file: record,
    p_require_open: mode === "public",
  });
  if (error || !saved) {
    await supabase.storage.from(ONBOARDING_BUCKET).remove([path]);
    if (error) console.error("[onboarding] document save failed", error.code);
    return failure(error ? friendlyDbError(error) : "This link is no longer accepting documents.", error ? 400 : 410);
  }
  await dropOtherFiles(supabase, row.id, slot, path);
  return { ok: true as const, name, size: bytes.byteLength };
}

export async function removeOnboardingDocument(
  supabase: Client,
  row: Pick<Row, "id" | "status" | "expires_at" | "documents">,
  slot: OnboardingSlot,
  mode: "public" | "staff",
) {
  if (mode === "public" && !onboardingOpen(row)) return failure("This link is no longer accepting documents.", 410);
  if (mode === "staff" && row.status === "revoked") return failure("This onboarding was revoked.", 409);
  const { data: saved, error } = await supabase.rpc("onboarding_set_document", {
    p_id: row.id,
    p_slot: slot,
    p_file: null,
    p_require_open: mode === "public",
  });
  if (error || !saved) return failure("That file could not be removed.", 400);
  await dropOtherFiles(supabase, row.id, slot, null);
  return { ok: true as const };
}

async function dropOtherFiles(supabase: Client, id: string, slot: OnboardingSlot, keep: string | null) {
  const folder = `${id}/${slot}`;
  const { data } = await supabase.storage.from(ONBOARDING_BUCKET).list(folder, { limit: 100 });
  const stale = (data ?? []).map((item) => `${folder}/${item.name}`).filter((path) => path !== keep);
  if (stale.length) await supabase.storage.from(ONBOARDING_BUCKET).remove(stale);
}

function preparedDocuments(row: Pick<Row, "documents">, hasCollege: boolean) {
  const parsed = readDocuments(row.documents);
  const dropCollege = !hasCollege ? parsed.college : undefined;
  const raw = row.documents && typeof row.documents === "object" && !Array.isArray(row.documents) ? { ...row.documents } : {};
  if (!hasCollege) delete raw.college;
  const missing = requiredSlots(hasCollege ? "yes" : "no").filter((slot) => !parsed[slot]);
  return { documents: raw as Json, dropCollege, missing };
}

function submitFailure(error: { code?: string; message: string }) {
  console.error("[onboarding] submit failed", error.code, error.message);
  if (error.code === "23514" && error.message && !/check constraint/i.test(error.message)) return error.message;
  if (error.code === "42501") return "The form could not be saved. Please try again in a few minutes.";
  return error.code === "23514" ? "Some details are missing or not in the right format." : friendlyDbError(error);
}

export async function submitOnboarding(supabase: Client, row: Pick<Row, "id" | "status" | "expires_at" | "documents">, payload: unknown, mode: "public" | "staff") {
  if (mode === "public") {
    if (row.status === "submitted" || row.status === "reviewed") return failure("These details were already submitted.", 409);
    if (!onboardingOpen(row)) return failure("This link is no longer active.", 410);
    const admin = createAdminClient();
    if (!admin) return failure("The form is temporarily unavailable.", 503);
    const allowed = await limited(admin, `onboarding-submit:${row.id}`);
    if (!allowed) return failure("Too many attempts on this link. Wait a while and try again.", 429);
  } else if (row.status === "revoked") {
    return failure("This onboarding was revoked.", 409);
  }

  const parsed = onboardingSchema.safeParse(payload);
  if (!parsed.success) return failure("Please review the highlighted fields.", 422, issuesToFields(parsed.error));

  const hasCollege = parsed.data.has_college === "yes";
  const { documents, dropCollege, missing } = preparedDocuments(row, hasCollege);
  if (missing.length) {
    const fieldErrors: Record<string, string> = {};
    for (const slot of missing) fieldErrors[`file_${slot}`] = "Upload this document.";
    return failure("Upload the missing documents.", 422, fieldErrors);
  }

  const saved = await saveSubmission(supabase, row, submissionColumns(parsed.data), documents, mode === "public");
  if (!saved.ok) return saved;
  if (dropCollege) await supabase.storage.from(ONBOARDING_BUCKET).remove([dropCollege.path]);
  return { ok: true as const, id: saved.id, name: parsed.data.full_name };
}

function missingSubmitFunction(error: { code?: string; message: string }) {
  return error.code === "PGRST202" || /schema cache/i.test(error.message);
}

async function saveSubmission(
  supabase: Client,
  row: Pick<Row, "id" | "status">,
  data: ReturnType<typeof submissionColumns>,
  documents: Json,
  requireOpen: boolean,
) {
  const rpc = await supabase.rpc("onboarding_submit", {
    p_id: row.id,
    p_patch: data as unknown as Json,
    p_require_open: requireOpen,
  });
  if (!rpc.error && rpc.data) return { ok: true as const, id: rpc.data };
  if (rpc.error && !missingSubmitFunction(rpc.error)) return failure(submitFailure(rpc.error), 400);

  const now = new Date().toISOString();
  const nextStatus: OnboardingStatus = row.status === "reviewed" ? "reviewed" : "submitted";
  let update = supabase
    .from("employee_onboardings")
    .update({
      ...data,
      documents,
      status: nextStatus,
      ...(row.status === "open" ? { submitted_at: now } : {}),
    })
    .eq("id", row.id);
  update = requireOpen ? update.eq("status", "open") : update.neq("status", "revoked");
  const direct = await update.select("id").maybeSingle();
  if (direct.error) return failure(submitFailure(direct.error), 400);
  if (!direct.data) return failure("The form could not be saved. Please submit it again.", 409);
  return { ok: true as const, id: direct.data.id };
}

export async function deleteOnboardingObjects(supabase: Client, id: string) {
  const paths: string[] = [];
  for (const slot of ["photo", "aadhaar", "pan", "bank_proof", "tenth", "twelfth", "college"] as const) {
    const { data } = await supabase.storage.from(ONBOARDING_BUCKET).list(`${id}/${slot}`, { limit: 100 });
    for (const item of data ?? []) paths.push(`${id}/${slot}/${item.name}`);
  }
  if (paths.length) await supabase.storage.from(ONBOARDING_BUCKET).remove(paths);
}
