import "server-only";

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** Word documents arrive as simple HTML from mammoth; keep headings and lists so sections stay labelled. */
function htmlToText(html: string) {
  return html
    .replace(/<h([1-6])[^>]*>/gi, (_, level: string) => `\n\n${"#".repeat(Number(level))} `)
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|ul|ol|table|tr)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#?\w+);/g, (m, name: string) => entities[name] ?? m);
}

export async function extractText(bytes: ArrayBuffer, type: string): Promise<string> {
  switch (type) {
    case "application/pdf": {
      const { extractText: readPdf, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await readPdf(pdf, { mergePages: false });
      return text.map((page) => page.trim()).filter(Boolean).join("\n\n");
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
      return htmlToText(value);
    }
    default:
      return new TextDecoder("utf-8").decode(bytes);
  }
}
