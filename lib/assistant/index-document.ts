import "server-only";
import { chunkText, embeddingInput } from "@/lib/assistant/chunk";
import { extractText } from "@/lib/assistant/extract";
import { embed, isAssistantConfigured, toVector } from "@/lib/assistant/openai";
import { KNOWLEDGE_BUCKET, knowledgeType } from "@/lib/knowledge";
import type { createClient } from "@/lib/supabase/server";

type Client = ReturnType<typeof createClient>;

const INSERT_BATCH = 25;
const MAX_STORED_TEXT = 600_000;

class IndexError extends Error {}

/**
 * Reads a knowledge document (article text or the uploaded file), splits it into sections, embeds
 * them, and replaces the document's previous sections. Runs as the signed-in admin or manager.
 */
export async function indexDocument(supabase: Client, documentId: string): Promise<{ ok: true; chunks: number } | { ok: false; error: string }> {
  const { data: doc } = await supabase
    .from("kb_documents")
    .select("id, title, kind, body, file_path, file_name, file_type")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { ok: false, error: "That document could not be found." };

  await supabase.from("kb_documents").update({ status: "processing", error: null }).eq("id", doc.id);

  try {
    let text = doc.body;
    if (doc.kind === "file") {
      if (!doc.file_path) throw new IndexError("The uploaded file is missing. Upload it again.");
      const { data: blob, error } = await supabase.storage.from(KNOWLEDGE_BUCKET).download(doc.file_path);
      if (error || !blob) throw new IndexError("The uploaded file could not be read. Upload it again.");
      const type = doc.file_type ?? knowledgeType(doc.file_name ?? doc.file_path);
      if (!type) throw new IndexError("This file type isn't supported.");
      try {
        text = (await extractText(await blob.arrayBuffer(), type)).slice(0, MAX_STORED_TEXT);
      } catch {
        throw new IndexError("The text in this file couldn't be read. If it's password-protected or damaged, save a fresh copy and upload that.");
      }
      if (text.replace(/\s/g, "").length < 20) {
        throw new IndexError("No text was found in this file. Scanned PDFs are images; run them through OCR or paste the text as an article.");
      }
    }

    const chunks = chunkText(text);
    if (!chunks.length) throw new IndexError("This document has no text to learn from.");

    if (!isAssistantConfigured()) {
      throw new IndexError("Largis AI isn't switched on yet. Add the OpenAI API key, then choose Process again.");
    }
    let vectors: number[][];
    try {
      vectors = await embed(chunks.map((c) => embeddingInput(doc.title, c)));
    } catch (err) {
      console.error("[assistant] Embedding failed", err instanceof Error ? err.message : err);
      throw new IndexError("The AI service couldn't process this document. Try again in a minute.");
    }

    const { error: clearError } = await supabase.from("kb_chunks").delete().eq("document_id", doc.id);
    if (clearError) throw new IndexError("The previous version couldn't be replaced. Try again.");

    for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
      const rows = chunks.slice(i, i + INSERT_BATCH).map((c, j) => ({
        document_id: doc.id,
        chunk_index: i + j,
        heading: c.heading,
        content: c.content,
        embedding: toVector(vectors[i + j]),
      }));
      const { error } = await supabase.from("kb_chunks").insert(rows);
      if (error) {
        console.error("[assistant] Saving sections failed", error.message);
        throw new IndexError("The document's sections couldn't be saved. Try again.");
      }
    }

    await supabase
      .from("kb_documents")
      .update({ status: "ready", error: null, chunk_count: chunks.length, ...(doc.kind === "file" ? { body: text } : {}) })
      .eq("id", doc.id);
    return { ok: true, chunks: chunks.length };
  } catch (err) {
    const message = err instanceof IndexError ? err.message : "Something went wrong while processing this document. Try again.";
    if (!(err instanceof IndexError)) console.error("[assistant] Indexing failed", err);
    await supabase.from("kb_documents").update({ status: "error", error: message, chunk_count: 0 }).eq("id", doc.id);
    await supabase.from("kb_chunks").delete().eq("document_id", doc.id);
    return { ok: false, error: message };
  }
}
