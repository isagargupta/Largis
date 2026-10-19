"use server";

import { revalidatePath } from "next/cache";
import { indexDocument } from "@/lib/assistant/index-document";
import { KNOWLEDGE_BUCKET, knowledgeFileError, knowledgeStoragePath, knowledgeType, titleFromFileName } from "@/lib/knowledge";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { getStaffMember, getUser } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, knowledgeArticleSchema, knowledgeUploadSchema } from "@/lib/validations/portal";

async function managerContext() {
  const [user, staff] = await Promise.all([getUser(), getStaffMember()]);
  if (!user || !staff) return null;
  return staff.role === "admin" || staff.role === "manager" ? { user, staff } : null;
}

const NOT_ALLOWED = "Only staff admins and managers can change the knowledge base.";

function refresh(id?: string) {
  revalidatePath("/staff/knowledge");
  if (id) revalidatePath(`/staff/knowledge/${id}`);
}

export async function saveKnowledgeArticle(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx) return failure(NOT_ALLOWED);

  const parsed = knowledgeArticleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const supabase = createClient();
  const now = new Date().toISOString();
  const values = { title: input.title, category: input.category, body: input.body, status: "processing" as const };
  const { data: doc, error } = input.id
    ? await supabase
        .from("kb_documents")
        .update({ ...values, updated_by: ctx.user.id, updated_at: now })
        .eq("id", input.id)
        .eq("kind", "article")
        .select("id, title")
        .maybeSingle()
    : await supabase
        .from("kb_documents")
        .insert({ ...values, kind: "article" })
        .select("id, title")
        .single();
  if (error) return failure(friendlyDbError(error));
  if (!doc) return failure("That article could not be found.");

  const result = await indexDocument(supabase, doc.id);
  await logActivity(supabase, {
    action: input.id ? "knowledge.updated" : "knowledge.created",
    entity: "knowledge",
    entity_id: doc.id,
    metadata: { label: doc.title },
  });
  refresh(doc.id);

  if (!result.ok) return { status: "error", id: doc.id, message: `Saved, but Largis AI can't use it yet: ${result.error}` };
  return { status: "success", id: doc.id, message: input.id ? "Article updated. Largis AI is using the new version." : "Article added. Largis AI can now answer from it." };
}

/** Registers an upload and returns where the browser should put the file; processing starts once it's there. */
export async function startKnowledgeUpload(input: {
  name: string;
  type: string;
  size: number;
  category?: string;
}): Promise<{ ok: true; id: string; path: string } | { ok: false; error: string }> {
  const ctx = await managerContext();
  if (!ctx) return { ok: false, error: NOT_ALLOWED };

  const parsed = knowledgeUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That file can't be added." };
  const invalid = knowledgeFileError(parsed.data);
  if (invalid) return { ok: false, error: invalid };
  const type = knowledgeType(parsed.data.name, parsed.data.type)!;

  const id = crypto.randomUUID();
  const path = knowledgeStoragePath(id, parsed.data.name, type);
  const supabase = createClient();
  const { error } = await supabase.from("kb_documents").insert({
    id,
    kind: "file",
    title: titleFromFileName(parsed.data.name),
    category: parsed.data.category,
    file_path: path,
    file_name: parsed.data.name.slice(0, 200),
    file_type: type,
    file_size: parsed.data.size,
    status: "processing",
  });
  if (error) return { ok: false, error: friendlyDbError(error) };
  return { ok: true, id, path };
}

export async function finishKnowledgeUpload(id: string): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx) return failure(NOT_ALLOWED);
  const supabase = createClient();
  const result = await indexDocument(supabase, id);
  const { data: doc } = await supabase.from("kb_documents").select("title").eq("id", id).maybeSingle();
  if (doc) {
    await logActivity(supabase, { action: "knowledge.created", entity: "knowledge", entity_id: id, metadata: { label: doc.title } });
  }
  refresh(id);
  return result.ok ? { status: "success", id, message: `${doc?.title ?? "Document"} is ready.` } : failure(result.error);
}

export async function reprocessKnowledgeDocument(id: string): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx) return failure(NOT_ALLOWED);
  const result = await indexDocument(createClient(), id);
  refresh(id);
  return result.ok ? { status: "success", message: `Processed into ${result.chunks} sections.` } : failure(result.error);
}

export async function updateKnowledgeDetails(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx) return failure(NOT_ALLOWED);
  const parsed = knowledgeArticleSchema
    .pick({ id: true, title: true, category: true })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.id) return failure("Please review the highlighted fields.", parsed.success ? undefined : fieldErrorsFrom(parsed.error));

  const supabase = createClient();
  const { data: doc, error } = await supabase
    .from("kb_documents")
    .update({ title: parsed.data.title, category: parsed.data.category, updated_by: ctx.user.id, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("id, title")
    .maybeSingle();
  if (error) return failure(friendlyDbError(error));
  if (!doc) return failure("That document could not be found.");
  const result = await indexDocument(supabase, doc.id);
  await logActivity(supabase, { action: "knowledge.updated", entity: "knowledge", entity_id: doc.id, metadata: { label: doc.title } });
  refresh(doc.id);
  return result.ok ? { status: "success", message: "Details saved." } : failure(result.error);
}

export async function deleteKnowledgeDocument(id: string): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx) return failure(NOT_ALLOWED);
  const supabase = createClient();
  const { data: doc, error } = await supabase.from("kb_documents").delete().eq("id", id).select("title, file_path").maybeSingle();
  if (error) return failure(friendlyDbError(error));
  if (!doc) return failure("That document could not be found.");
  if (doc.file_path) await supabase.storage.from(KNOWLEDGE_BUCKET).remove([doc.file_path]);
  await logActivity(supabase, { action: "knowledge.deleted", entity: "knowledge", entity_id: id, metadata: { label: doc.title } });
  refresh();
  return { status: "success", message: `${doc.title} was removed. Largis AI no longer uses it.` };
}

export async function setAssistantFeedback(messageId: string, value: -1 | 1 | null): Promise<{ ok: boolean }> {
  const [user, staff] = await Promise.all([getUser(), getStaffMember()]);
  if (!user || !staff || ![-1, 1, null].includes(value)) return { ok: false };
  const { error } = await createClient().from("assistant_messages").update({ feedback: value }).eq("id", messageId).eq("role", "assistant");
  return { ok: !error };
}

export async function deleteAssistantConversation(id: string): Promise<{ ok: boolean }> {
  const [user, staff] = await Promise.all([getUser(), getStaffMember()]);
  if (!user || !staff) return { ok: false };
  const { error } = await createClient().from("assistant_conversations").delete().eq("id", id);
  revalidatePath("/staff/assistant", "layout");
  return { ok: !error };
}
