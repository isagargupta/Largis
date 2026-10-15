import type { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

/** A file on a chat message, ticket, or ticket reply. Name, type, and size are set by the database. */
export type Attachment = { path: string; name: string; type: string; size: number };

export const ATTACHMENT_BUCKET = "attachments";
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const attachmentTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** For file inputs. */
export const attachmentAccept = Object.keys(attachmentTypes).join(",") + ",.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.pdf";

const typeByExtension: Record<string, string> = Object.fromEntries(Object.entries(attachmentTypes).map(([type, ext]) => [ext, type]));
typeByExtension.jpeg = "image/jpeg";

/** Browsers sometimes report an empty or generic type; fall back to the extension. */
export function attachmentType(name: string, reported?: string | null) {
  if (reported && attachmentTypes[reported]) return reported;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return typeByExtension[ext] ?? null;
}

export function isImageAttachment(a: Pick<Attachment, "type">) {
  return a.type.startsWith("image/") && a.type !== "image/heic" && a.type !== "image/heif";
}

/** Storage keys allow a narrow character set; the original name is kept separately for display. */
export function storageFileName(name: string, type: string) {
  const ext = attachmentTypes[type] ?? "bin";
  const base = name
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `${base || "file"}.${ext}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function attachmentSummary(items: Attachment[]) {
  if (!items.length) return "";
  return items.length === 1 ? `Sent a file: ${items[0].name}` : `Sent ${items.length} files`;
}

export function parseAttachments(value: Json | undefined | null): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return [];
    const { path, name, type, size } = v as Record<string, Json | undefined>;
    if (typeof path !== "string") return [];
    return [{ path, name: typeof name === "string" ? name : "File", type: typeof type === "string" ? type : "", size: typeof size === "number" ? size : 0 }];
  });
}

/** Opens a file through the portal, which checks access and redirects to a short-lived link. */
export function attachmentHref(path: string, download = false) {
  return `/api/attachments?path=${encodeURIComponent(path)}${download ? "&download=1" : ""}`;
}

export function attachmentError(file: { name: string; size: number; type?: string | null }) {
  if (!attachmentType(file.name, file.type)) return `${file.name} isn't a supported file type. Use images, PDFs, or Office documents.`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name} is larger than 10 MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

/** Uploads one file into the organization's folder; send the result with the message. */
export async function uploadAttachment(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  file: File,
): Promise<{ ok: true; attachment: Attachment } | { ok: false; error: string }> {
  const invalid = attachmentError(file);
  if (invalid) return { ok: false, error: invalid };
  const type = attachmentType(file.name, file.type)!;
  const path = `${organizationId}/${crypto.randomUUID()}/${storageFileName(file.name, type)}`;
  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: type, upsert: false });
  if (error) return { ok: false, error: `${file.name} could not be uploaded. Please try again.` };
  return { ok: true, attachment: { path, name: file.name.slice(0, 200), type, size: file.size } };
}

/** Deletes a file the user removed before sending. Storage refuses once a message lists it; the daily cleanup catches misses. */
export function discardAttachment(supabase: ReturnType<typeof createClient>, path: string) {
  void supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
}
