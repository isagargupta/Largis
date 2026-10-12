import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * A deliberately small Markdown subset for client reports: headings, paragraphs, lists, quotes,
 * tables, code, rules, **bold**, *italic*, inline code, and links. Output is built from React elements,
 * so raw HTML in the source is shown as text, never injected.
 */

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; start: number; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "rule" }
  | { kind: "table"; header: string[]; align: ("left" | "center" | "right")[]; rows: string[][] };

const HEADING = /^(#{1,4})\s+(.+?)\s*#*\s*$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const FENCE = /^\s*```/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function startsBlock(line: string, next: string | undefined) {
  return (
    HEADING.test(line) ||
    RULE.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    QUOTE.test(line) ||
    FENCE.test(line) ||
    (line.includes("|") && next !== undefined && TABLE_DIVIDER.test(next))
  );
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    if (FENCE.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map((cell) =>
        cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left",
      );
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(splitRow(lines[i++]));
      blocks.push({ kind: "table", header, align, rows });
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(QUOTE.exec(lines[i++])![1]);
      blocks.push({ kind: "quote", text: body.join(" ") });
      continue;
    }

    const bullet = BULLET.test(line);
    const ordered = ORDERED.exec(line);
    if (bullet || ordered) {
      const pattern = bullet ? BULLET : ORDERED;
      const items: string[] = [];
      while (i < lines.length) {
        const match = pattern.exec(lines[i]);
        if (match) {
          items.push(bullet ? match[1] : match[2]);
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += ` ${lines[i++].trim()}`;
        } else {
          break;
        }
      }
      blocks.push({ kind: "list", ordered: !bullet, start: ordered ? Number(ordered[1]) : 1, items });
      continue;
    }

    const body: string[] = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i + 1])) body.push(lines[i++].trim());
    blocks.push({ kind: "paragraph", text: body.join(" ") });
  }

  return blocks;
}

const INLINE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*/g;

function safeHref(url: string) {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(url) ? url : null;
}

function inline(text: string, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of Array.from(text.matchAll(INLINE))) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const k = `${key}-${n++}`;
    const [, code, linkText, linkUrl, bold, em] = match;
    if (code !== undefined) {
      out.push(
        <code key={k} className="bg-paper-soft px-1 py-0.5 font-mono text-[0.9em] text-ink">
          {code}
        </code>,
      );
    } else if (linkText !== undefined) {
      const href = safeHref(linkUrl);
      const external = href ? /^https?:/i.test(href) : false;
      out.push(
        href ? (
          <a
            key={k}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="text-brand-700 underline underline-offset-4 hover:text-brand-800"
          >
            {inline(linkText, k)}
          </a>
        ) : (
          <span key={k}>{inline(linkText, k)}</span>
        ),
      );
    } else if (bold !== undefined) {
      out.push(
        <strong key={k} className="font-semibold text-ink">
          {inline(bold, k)}
        </strong>,
      );
    } else {
      out.push(<em key={k}>{inline(em, k)}</em>);
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const headingStyles: Record<number, string> = {
  1: "mt-8 text-xl font-semibold tracking-[-0.01em] text-ink first:mt-0",
  2: "mt-7 text-lg font-semibold tracking-[-0.01em] text-ink first:mt-0",
  3: "mt-6 text-base font-semibold text-ink first:mt-0",
  4: "mt-5 text-sm font-semibold uppercase tracking-[0.08em] text-ink-subtle first:mt-0",
};

function renderBlock(block: Block, key: number) {
  switch (block.kind) {
    case "heading": {
      // The page title is the h1, so report headings start at h2.
      const Tag = (["h2", "h3", "h4", "h5"] as const)[block.level - 1];
      return (
        <Tag key={key} className={headingStyles[block.level]}>
          {inline(block.text, `h${key}`)}
        </Tag>
      );
    }
    case "paragraph":
      return <p key={key}>{inline(block.text, `p${key}`)}</p>;
    case "quote":
      return (
        <blockquote key={key} className="border-l-2 border-gold-500 bg-paper-soft/60 px-4 py-2 text-ink">
          {inline(block.text, `q${key}`)}
        </blockquote>
      );
    case "code":
      return (
        <pre key={key} className="overflow-x-auto border border-line bg-paper-soft p-4 font-mono text-[13px] leading-relaxed text-ink">
          <code>{block.text}</code>
        </pre>
      );
    case "rule":
      return <hr key={key} className="border-line" />;
    case "list": {
      const items = block.items.map((item, j) => (
        <li key={j} className="pl-1">
          {inline(item, `l${key}-${j}`)}
        </li>
      ));
      return block.ordered ? (
        <ol key={key} start={block.start} className="list-decimal space-y-1.5 pl-6 marker:text-ink-subtle">
          {items}
        </ol>
      ) : (
        <ul key={key} className="list-disc space-y-1.5 pl-6 marker:text-gold-500">
          {items}
        </ul>
      );
    }
    case "table":
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink/20">
                {block.header.map((cell, c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-semibold text-ink" style={{ textAlign: block.align[c] ?? "left" }}>
                    {inline(cell, `t${key}-h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {block.header.map((_, c) => (
                    <td key={c} className="px-3 py-2 tabular-nums" style={{ textAlign: block.align[c] ?? "left" }}>
                      {inline(row[c] ?? "", `t${key}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={cn("space-y-4 break-words text-[15px] leading-relaxed text-ink-muted", className)}>
      {blocks.map(renderBlock)}
    </div>
  );
}
