import "server-only";
import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_BATCH = 96;

let client: OpenAI | null = null;

export function isAssistantConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function openai() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  client ??= new OpenAI({ apiKey, timeout: 55_000, maxRetries: 2 });
  return client;
}

export function chatModel() {
  return process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-5.4-mini";
}

/** Reasoning models take an effort setting instead of a temperature. */
export function reasoningOptions(model: string) {
  return /^(gpt-5|gpt-6|o\d)/.test(model) ? { reasoning_effort: "low" as const } : {};
}

export async function embed(texts: string[]): Promise<number[][]> {
  const api = openai();
  if (!api) throw new Error("The assistant isn't configured: OPENAI_API_KEY is missing.");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH).map((t) => t.slice(0, 24_000));
    const response = await api.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    response.data.sort((a, b) => a.index - b.index).forEach((d) => out.push(d.embedding));
  }
  return out;
}

/** pgvector accepts vectors as a bracketed list. */
export function toVector(values: number[]) {
  return `[${values.join(",")}]`;
}
