export type Chunk = { heading: string | null; content: string };

const TARGET = 2400;
const MAX = 3200;
const OVERLAP = 300;
export const MAX_CHUNKS = 400;

const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;

function normalize(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits an overlong paragraph at sentence ends, falling back to hard cuts. */
function splitLong(block: string): string[] {
  if (block.length <= MAX) return [block];
  const sentences = block.match(/[^.!?\n]+(?:[.!?]+|\n|$)\s*/g) ?? [block];
  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > TARGET) {
      out.push(current.trim());
      current = "";
    }
    if (sentence.length > MAX) {
      for (let i = 0; i < sentence.length; i += TARGET) out.push(sentence.slice(i, i + TARGET).trim());
    } else {
      current += sentence;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

function tail(text: string) {
  if (text.length <= OVERLAP) return text;
  const cut = text.slice(-OVERLAP);
  const space = cut.indexOf(" ");
  return space > 0 ? cut.slice(space + 1) : cut;
}

/**
 * Splits a document into overlapping sections of roughly 2,400 characters, keeping the nearest
 * Markdown heading with each so answers can cite where they came from.
 */
export function chunkText(text: string): Chunk[] {
  const blocks = normalize(text).split(/\n\s*\n/);
  const chunks: Chunk[] = [];
  let heading: string | null = null;
  let current = "";
  let currentHeading: string | null = null;

  const flush = () => {
    const content = current.trim();
    if (content) chunks.push({ heading: currentHeading, content });
    current = "";
  };

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    const lines = block.split("\n");
    const match = HEADING.exec(lines[0]);
    if (match) {
      flush();
      heading = match[2].replace(/[*_`]/g, "").slice(0, 300);
      currentHeading = heading;
      const rest = lines.slice(1).join("\n").trim();
      if (!rest) continue;
      current = rest;
      continue;
    }

    for (const piece of splitLong(block)) {
      if (current && current.length + piece.length + 2 > TARGET) {
        const carry = tail(current);
        flush();
        current = carry;
      }
      currentHeading = heading;
      current = current ? `${current}\n\n${piece}` : piece;
    }
    if (chunks.length >= MAX_CHUNKS) break;
  }
  flush();
  return chunks.slice(0, MAX_CHUNKS);
}

/** What gets embedded: the document title and section heading give each passage its context. */
export function embeddingInput(title: string, chunk: Chunk) {
  return [title, chunk.heading, chunk.content].filter(Boolean).join("\n\n");
}
