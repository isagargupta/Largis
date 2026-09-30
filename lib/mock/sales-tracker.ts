import type { LeadStage, OrgRole } from "@/lib/supabase/types";

export type Organization = {
  id: string;
  name: string;
  plan: "Enterprise" | "Growth";
  region: string;
  metrics: {
    revenue: number;
    revenueDelta: number;
    activeLeads: number;
    leadsDelta: number;
    conversionRate: number;
    conversionDelta: number;
    bpoResponseSeconds: number;
    responseDelta: number;
  };
};

export type Lead = {
  id: string;
  organizationId: string;
  company: string;
  contact: string;
  stage: LeadStage;
  value: number;
  ownerId: string;
  owner: string;
  source: "Inbound" | "BPO Chat" | "Referral" | "Outbound" | "Partner";
  updatedAt: string;
};

export type Viewer = { id: string; name: string; role: OrgRole };

export const organizations: Organization[] = [
  {
    id: "org_acme",
    name: "Acme Corp",
    plan: "Enterprise",
    region: "ap-south-1",
    metrics: {
      revenue: 2_480_000,
      revenueDelta: 18.2,
      activeLeads: 1284,
      leadsDelta: 6.4,
      conversionRate: 24.6,
      conversionDelta: 2.1,
      bpoResponseSeconds: 38,
      responseDelta: -12.5,
    },
  },
  {
    id: "org_globex",
    name: "Globex Wholesale",
    plan: "Enterprise",
    region: "eu-central-1",
    metrics: {
      revenue: 1_720_000,
      revenueDelta: 9.8,
      activeLeads: 862,
      leadsDelta: 3.2,
      conversionRate: 19.3,
      conversionDelta: -0.8,
      bpoResponseSeconds: 44,
      responseDelta: -6.1,
    },
  },
  {
    id: "org_initech",
    name: "Initech Logistics",
    plan: "Growth",
    region: "us-east-1",
    metrics: {
      revenue: 640_000,
      revenueDelta: 27.4,
      activeLeads: 318,
      leadsDelta: 14.9,
      conversionRate: 31.2,
      conversionDelta: 4.6,
      bpoResponseSeconds: 29,
      responseDelta: -18.3,
    },
  },
];

export const viewers: Viewer[] = [
  { id: "u_priya", name: "Priya Raman", role: "admin" },
  { id: "u_marcus", name: "Marcus Chen", role: "manager" },
  { id: "u_arjun", name: "Arjun Mehta", role: "agent" },
];

const owners = [
  { id: "u_marcus", name: "Marcus Chen" },
  { id: "u_arjun", name: "Arjun Mehta" },
  { id: "u_sofia", name: "Sofia Alvarez" },
  { id: "u_daniel", name: "Daniel Okafor" },
];

const seed: Record<string, Array<[string, string, LeadStage, number, number, Lead["source"], string]>> = {
  org_acme: [
    ["Northwind Traders", "Hannah Lee", "negotiation", 184000, 0, "Inbound", "2026-09-30T09:12:00Z"],
    ["Contoso Retail", "Liam Patel", "proposal", 96000, 1, "BPO Chat", "2026-09-30T07:40:00Z"],
    ["Fabrikam Industries", "Olivia Brooks", "qualified", 142000, 2, "Referral", "2026-09-29T16:05:00Z"],
    ["Tailspin Toys", "Noah Kim", "won", 58000, 1, "BPO Chat", "2026-09-29T11:22:00Z"],
    ["Wide World Importers", "Emma Davis", "new", 210000, 3, "Outbound", "2026-09-29T08:47:00Z"],
    ["Proseware Inc.", "Ava Wilson", "lost", 34000, 0, "Partner", "2026-09-28T14:30:00Z"],
    ["Litware Systems", "Ethan Moore", "qualified", 77000, 1, "Inbound", "2026-09-28T10:18:00Z"],
    ["Adventure Works", "Mia Taylor", "proposal", 128000, 2, "Referral", "2026-09-27T17:55:00Z"],
    ["Blue Yonder Airlines", "Lucas Martin", "negotiation", 265000, 3, "Partner", "2026-09-27T09:03:00Z"],
    ["Coho Winery", "Zoe Clark", "new", 22000, 1, "BPO Chat", "2026-09-26T13:41:00Z"],
  ],
  org_globex: [
    ["Lamna Healthcare", "Grace Hall", "proposal", 118000, 0, "Inbound", "2026-09-30T08:02:00Z"],
    ["Margie's Travel", "Henry Young", "qualified", 46000, 1, "BPO Chat", "2026-09-29T15:26:00Z"],
    ["Trey Research", "Chloe King", "won", 152000, 2, "Referral", "2026-09-29T09:44:00Z"],
    ["Alpine Ski House", "Jack Wright", "new", 38000, 1, "Outbound", "2026-09-28T12:10:00Z"],
    ["Relecloud", "Lily Scott", "negotiation", 204000, 3, "Partner", "2026-09-27T16:38:00Z"],
    ["Woodgrove Bank", "Owen Green", "lost", 89000, 0, "Inbound", "2026-09-26T10:55:00Z"],
  ],
  org_initech: [
    ["Southridge Video", "Ella Baker", "qualified", 42000, 1, "BPO Chat", "2026-09-30T06:15:00Z"],
    ["Fourth Coffee", "James Adams", "won", 28000, 1, "Inbound", "2026-09-29T13:08:00Z"],
    ["VanArsdel Ltd.", "Aria Nelson", "proposal", 64000, 2, "Referral", "2026-09-28T11:47:00Z"],
    ["Humongous Insurance", "Leo Carter", "new", 91000, 0, "Outbound", "2026-09-27T15:20:00Z"],
  ],
};

export const leads: Lead[] = Object.entries(seed).flatMap(([organizationId, rows]) =>
  rows.map(([company, contact, stage, value, ownerIdx, source, updatedAt], i) => ({
    id: `${organizationId}_lead_${i + 1}`,
    organizationId,
    company,
    contact,
    stage,
    value,
    ownerId: owners[ownerIdx].id,
    owner: owners[ownerIdx].name,
    source,
    updatedAt,
  })),
);

export const stageMeta: Record<LeadStage, { label: string; tone: "neutral" | "info" | "brand" | "warning" | "success" | "danger" }> = {
  new: { label: "New", tone: "neutral" },
  qualified: { label: "Qualified", tone: "info" },
  proposal: { label: "Proposal", tone: "brand" },
  negotiation: { label: "Negotiation", tone: "warning" },
  won: { label: "Closed Won", tone: "success" },
  lost: { label: "Closed Lost", tone: "danger" },
};

export const rolePermissions: Record<OrgRole, { label: string; scope: string; canViewValue: boolean; canEdit: boolean; ownOnly: boolean }> = {
  owner: { label: "Owner", scope: "Full organization access", canViewValue: true, canEdit: true, ownOnly: false },
  admin: { label: "Admin", scope: "Full organization access", canViewValue: true, canEdit: true, ownOnly: false },
  manager: { label: "Manager", scope: "Team pipeline · read & write", canViewValue: true, canEdit: true, ownOnly: false },
  agent: { label: "Agent", scope: "Assigned leads only · values masked", canViewValue: false, canEdit: true, ownOnly: true },
  viewer: { label: "Viewer", scope: "Read-only", canViewValue: true, canEdit: false, ownOnly: false },
};
