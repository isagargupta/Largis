import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import { api } from "@/lib/api";
import type { Json } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

/** A file on a chat message, ticket, or ticket reply. Name, type, and size are set by the database. */
export type Attachment = { path: string; name: string; type: string; size: number };

/** A file picked on the phone, before upload. */
export type PickedFile = { uri: string; name: string; type: string | null; size: number | null };

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

export const pickerTypes = Object.keys(attachmentTypes);

const typeByExtension: Record<string, string> = Object.fromEntries(Object.entries(attachmentTypes).map(([type, ext]) => [ext, type]));
typeByExtension.jpeg = "image/jpeg";

export function attachmentType(name: string, reported?: string | null) {
  if (reported && attachmentTypes[reported]) return reported;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return typeByExtension[ext] ?? null;
}

export function isImageAttachment(a: Pick<Attachment, "type">) {
  return a.type.startsWith("image/");
}

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

export function parseAttachments(value: Json | undefined | null): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return [];
    const { path, name, type, size } = v as Record<string, Json | undefined>;
    if (typeof path !== "string") return [];
    return [{ path, name: typeof name === "string" ? name : "File", type: typeof type === "string" ? type : "", size: typeof size === "number" ? size : 0 }];
  });
}

/** Uploads one picked file into the organization's folder; send the result with the message. */
export async function uploadAttachment(
  organizationId: string,
  file: PickedFile,
): Promise<{ ok: true; attachment: Attachment } | { ok: false; error: string }> {
  const type = attachmentType(file.name, file.type);
  if (!type) return { ok: false, error: `${file.name} isn't a supported file type.` };
  try {
    const bytes = await new File(file.uri).arrayBuffer();
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) return { ok: false, error: `${file.name} is larger than 10 MB.` };
    if (bytes.byteLength === 0) return { ok: false, error: `${file.name} is empty.` };
    const path = `${organizationId}/${Crypto.randomUUID()}/${storageFileName(file.name, type)}`;
    const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
    if (error) return { ok: false, error: `${file.name} could not be uploaded. Try again.` };
    return { ok: true, attachment: { path, name: file.name.slice(0, 200), type, size: bytes.byteLength } };
  } catch {
    return { ok: false, error: `${file.name} could not be read.` };
  }
}

/** Deletes a file the user removed before sending. Storage refuses once a message lists it; the daily cleanup catches misses. */
export function discardAttachment(path: string) {
  void supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
}

/** A short-lived link to view or download a file, checked by the website. */
export async function attachmentUrl(path: string, download = false) {
  const result = await api<{ url: string }>(
    `/api/attachments?format=json&path=${encodeURIComponent(path)}${download ? "&download=1" : ""}`,
  );
  return result.ok ? result.url : null;
}
