import type { KnowledgeStatus } from "@/lib/supabase/types";
import type { Tone } from "@/lib/portal/meta";

export const KNOWLEDGE_BUCKET = "knowledge";
export const MAX_KNOWLEDGE_BYTES = 15 * 1024 * 1024;
export const MAX_ARTICLE_LENGTH = 100_000;

export const knowledgeFileTypes: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
};

const typeByExtension: Record<string, string> = Object.fromEntries(
  Object.entries(knowledgeFileTypes).map(([type, ext]) => [ext, type]),
);
typeByExtension.markdown = "text/markdown";

export const knowledgeAccept = [...Object.keys(knowledgeFileTypes), ...Object.keys(typeByExtension).map((e) => `.${e}`)].join(",");

/** The stored type for an upload; browsers often report Markdown and CSV inconsistently, so the extension wins. */
export function knowledgeType(name: string, reported?: string | null) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return typeByExtension[ext] ?? (reported && knowledgeFileTypes[reported] ? reported : null);
}

export function knowledgeFileError(file: { name: string; size: number; type?: string | null }) {
  if (!knowledgeType(file.name, file.type)) return `${file.name} isn't supported. Use PDF, Word (.docx), text, Markdown, or CSV.`;
  if (file.size > MAX_KNOWLEDGE_BYTES) return `${file.name} is larger than 15 MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

export function knowledgeStoragePath(documentId: string, name: string, type: string) {
  const ext = knowledgeFileTypes[type] ?? "bin";
  const base =
    name
      .replace(/\.[^.]*$/, "")
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 80) || "document";
  return `${documentId}/${base}.${ext}`;
}

/** A readable title from a file name: "refund-policy_v2.pdf" becomes "Refund policy v2". */
export function titleFromFileName(name: string) {
  const base = name.replace(/\.[^.]*$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 200) || "Untitled document";
}

export const knowledgeStatusMeta: Record<KnowledgeStatus, { label: string; tone: Tone }> = {
  processing: { label: "Processing", tone: "info" },
  ready: { label: "Ready", tone: "success" },
  error: { label: "Needs attention", tone: "danger" },
};

export type AssistantSource = { n: number; documentId: string; title: string; heading: string | null };

export function parseSources(value: unknown): AssistantSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const s = v as Record<string, unknown>;
    if (typeof s.n !== "number" || typeof s.documentId !== "string" || typeof s.title !== "string") return [];
    return [{ n: s.n, documentId: s.documentId, title: s.title, heading: typeof s.heading === "string" ? s.heading : null }];
  });
}
