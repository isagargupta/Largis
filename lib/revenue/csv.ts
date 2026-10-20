export const CSV_IMPORT_LIMIT = 500;

export type CsvLead = {
  row: number;
  company: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stageLabel: string | null;
  value: string | null;
  notes: string | null;
  address: string | null;
  jobType: string | null;
};

const aliases: Record<string, keyof Omit<CsvLead, "row">> = {
  contact: "contactName",
  contact_name: "contactName",
  name: "contactName",
  phone: "phone",
  email: "email",
  contact_email: "email",
  company: "company",
  source: "source",
  stage: "stageLabel",
  value: "value",
  "deal value": "value",
  notes: "notes",
  address: "address",
  service_address: "address",
  job: "jobType",
  job_type: "jobType",
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parseLeadCsv(text: string): { leads: CsvLead[]; error?: string } {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  if (table.length < 2) return { leads: [], error: "The file needs a header row and at least one lead." };

  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const columns = header.map((name) => aliases[name] ?? null);
  if (!columns.some(Boolean)) {
    return {
      leads: [],
      error: "Use a header row with columns such as contact, phone, email, company, source, stage, value, and notes.",
    };
  }

  const leads: CsvLead[] = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    if (cells.every((cell) => !cell.trim())) continue;
    const lead: CsvLead = {
      row: i + 1,
      company: null,
      contactName: null,
      email: null,
      phone: null,
      source: null,
      stageLabel: null,
      value: null,
      notes: null,
      address: null,
      jobType: null,
    };
    columns.forEach((key, index) => {
      if (!key) return;
      const value = (cells[index] ?? "").trim();
      if (value) lead[key] = value;
    });
    leads.push(lead);
  }

  if (!leads.length) return { leads: [], error: "The file has a header but no leads." };
  if (leads.length > CSV_IMPORT_LIMIT) {
    return { leads: [], error: `Import up to ${CSV_IMPORT_LIMIT} leads at a time.` };
  }
  return { leads };
}
