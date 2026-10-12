import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatTaxRate } from "@/lib/portal/billing";
import { formatDay } from "@/lib/portal/format";
import { siteConfig } from "@/lib/site";
import type { Currency } from "@/lib/supabase/types";

export type InvoicePdfInput = {
  number: string;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  subtotalCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  organizationName: string;
  billTo: string | null;
  contractTitle: string | null;
  notes: string | null;
  items: { description: string; quantity: number; unitPriceCents: number; amountCents: number }[];
};

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const INK = rgb(0.09, 0.1, 0.13);
const MUTED = rgb(0.38, 0.4, 0.45);
const LINE = rgb(0.85, 0.83, 0.78);
const BRAND = rgb(0.18, 0.26, 0.56);

const WIN_ANSI_EXTRAS = new Set(Array.from("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"));

/** Standard PDF fonts only cover WinAnsi; anything else becomes "?" rather than failing the whole PDF. */
function safe(text: string) {
  return Array.from(text.replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(/₹\s?/g, "INR "))
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (ch === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(ch)) return ch;
      return "?";
    })
    .join("");
}

function money(cents: number, currency: Currency) {
  const amount = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `${currency} ${amount}`;
}

function quantity(value: number) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of safe(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderInvoicePdf(input: InvoicePdfInput) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${input.number}`);
  doc.setAuthor(siteConfig.legalName);
  doc.setCreator(siteConfig.name);
  doc.setProducer(siteConfig.name);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const right = PAGE.width - MARGIN;
  const contentWidth = right - MARGIN;

  const text = (value: string, x: number, size = 9.5, font = regular, color = INK) => {
    page.drawText(safe(value), { x, y, size, font, color });
  };
  const textRight = (value: string, x: number, size = 9.5, font = regular, color = INK) => {
    const v = safe(value);
    page.drawText(v, { x: x - font.widthOfTextAtSize(v, size), y, size, font, color });
  };
  const rule = (color = LINE, thickness = 0.75) => {
    page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness, color });
  };
  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
    text(`Invoice ${input.number} (continued)`, MARGIN, 9, regular, MUTED);
    y -= 24;
  };
  const ensure = (space: number) => {
    if (y - space < MARGIN + 40) newPage();
  };

  // Header
  page.drawRectangle({ x: MARGIN, y: y - 2, width: 28, height: 3, color: rgb(0.71, 0.56, 0.3) });
  y -= 22;
  text(input.taxRateBps > 0 ? "TAX INVOICE" : "INVOICE", MARGIN, 18, bold, BRAND);
  textRight(input.number, right, 14, bold);
  y -= 18;
  textRight(`Issued ${formatDay(input.issueDate)}`, right, 9.5, regular, MUTED);
  y -= 13;
  textRight(`Due ${formatDay(input.dueDate)}`, right, 9.5, bold);

  // Supplier and recipient
  y -= 30;
  const columnWidth = contentWidth / 2 - 12;
  const colTop = y;
  text("FROM", MARGIN, 8, bold, MUTED);
  y -= 14;
  text(siteConfig.legalName, MARGIN, 10.5, bold);
  y -= 13;
  for (const line of wrap(siteConfig.address, regular, 9.5, columnWidth)) {
    text(line, MARGIN);
    y -= 12;
  }
  text(`GSTIN: ${siteConfig.gstin}`, MARGIN);
  y -= 12;
  text(`CIN: ${siteConfig.cin}`, MARGIN);
  y -= 12;
  text(siteConfig.email, MARGIN, 9.5, regular, MUTED);
  const leftBottom = y;

  y = colTop;
  const billX = MARGIN + contentWidth / 2 + 12;
  text("BILL TO", billX, 8, bold, MUTED);
  y -= 14;
  for (const line of wrap(input.organizationName, bold, 10.5, columnWidth)) {
    text(line, billX, 10.5, bold);
    y -= 13;
  }
  if (input.billTo) {
    for (const line of wrap(input.billTo, regular, 9.5, columnWidth).slice(0, 10)) {
      text(line, billX);
      y -= 12;
    }
  }
  if (input.contractTitle) {
    y -= 4;
    for (const line of wrap(`Contract: ${input.contractTitle}`, regular, 9, columnWidth)) {
      text(line, billX, 9, regular, MUTED);
      y -= 11;
    }
  }
  y = Math.min(y, leftBottom) - 18;

  // Line items
  const col = { num: MARGIN, desc: MARGIN + 22, qty: right - 210, unit: right - 100, amount: right };
  const descWidth = col.qty - col.desc - 40;
  const header = () => {
    page.drawRectangle({ x: MARGIN, y: y - 6, width: contentWidth, height: 20, color: rgb(0.96, 0.95, 0.92) });
    y += 1;
    text("#", col.num + 4, 8.5, bold, MUTED);
    text("Description", col.desc, 8.5, bold, MUTED);
    textRight("Qty", col.qty, 8.5, bold, MUTED);
    textRight("Unit price", col.unit, 8.5, bold, MUTED);
    textRight("Amount", col.amount - 4, 8.5, bold, MUTED);
    y -= 22;
  };
  header();

  input.items.forEach((item, i) => {
    const lines = wrap(item.description, regular, 9.5, descWidth);
    ensure(lines.length * 12 + 10);
    if (y > PAGE.height - MARGIN - 40) header();
    text(String(i + 1), col.num + 4, 9.5, regular, MUTED);
    textRight(quantity(item.quantity), col.qty);
    textRight(money(item.unitPriceCents, input.currency), col.unit);
    textRight(money(item.amountCents, input.currency), col.amount - 4);
    for (const line of lines) {
      text(line, col.desc);
      y -= 12;
    }
    y -= 4;
    rule();
    y -= 14;
  });

  // Totals
  ensure(80);
  const labelX = right - 230;
  const totalsRow = (label: string, value: string, strong = false) => {
    text(label, labelX, strong ? 10.5 : 9.5, strong ? bold : regular, strong ? INK : MUTED);
    textRight(value, col.amount - 4, strong ? 10.5 : 9.5, strong ? bold : regular);
    y -= strong ? 18 : 15;
  };
  totalsRow("Subtotal", money(input.subtotalCents, input.currency));
  totalsRow(`GST (${formatTaxRate(input.taxRateBps)})`, money(input.taxCents, input.currency));
  y += 6;
  page.drawLine({ start: { x: labelX, y }, end: { x: right, y }, thickness: 1, color: INK });
  y -= 14;
  totalsRow("Total due", money(input.totalCents, input.currency), true);

  // Payment and notes
  y -= 10;
  const instructions =
    process.env.BILLING_PAYMENT_INSTRUCTIONS?.trim() ||
    `Pay by bank transfer to ${siteConfig.legalName}. Bank account details are provided by your Largis account manager.`;
  const paragraphs: [string, string][] = [
    ["PAYMENT", `${instructions}\nPlease quote ${input.number} as the payment reference. Payment is due by ${formatDay(input.dueDate)}.`],
    ...(input.notes ? ([["NOTES", input.notes]] as [string, string][]) : []),
  ];
  for (const [label, body] of paragraphs) {
    const lines = wrap(body, regular, 9.5, contentWidth);
    ensure(20 + lines.length * 12);
    text(label, MARGIN, 8, bold, MUTED);
    y -= 14;
    for (const line of lines) {
      ensure(12);
      text(line, MARGIN);
      y -= 12;
    }
    y -= 12;
  }

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const footer = safe(`${siteConfig.legalName} · GSTIN ${siteConfig.gstin} · CIN ${siteConfig.cin}`);
    p.drawLine({ start: { x: MARGIN, y: MARGIN + 22 }, end: { x: right, y: MARGIN + 22 }, thickness: 0.5, color: LINE });
    p.drawText(footer, { x: MARGIN, y: MARGIN + 8, size: 7.5, font: regular, color: MUTED });
    p.drawText("Computer-generated invoice; no signature required.", { x: MARGIN, y: MARGIN - 2, size: 7.5, font: regular, color: MUTED });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: right - regular.widthOfTextAtSize(label, 7.5), y: MARGIN + 8, size: 7.5, font: regular, color: MUTED });
  });

  return doc.save();
}
