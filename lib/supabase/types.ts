export type OrgRole = "owner" | "admin" | "manager" | "agent" | "viewer";
export type LeadStage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

type Timestamps = { created_at: string };

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; slug: string } & Timestamps;
        Insert: { id?: string; name: string; slug: string };
        Update: { name?: string; slug?: string };
        Relationships: [];
      };
      memberships: {
        Row: { organization_id: string; user_id: string; role: OrgRole } & Timestamps;
        Insert: { organization_id: string; user_id: string; role?: OrgRole };
        Update: { role?: OrgRole };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          organization_id: string;
          company: string;
          contact_name: string;
          stage: LeadStage;
          value_cents: number;
          owner_id: string | null;
          source: string | null;
          updated_at: string;
        } & Timestamps;
        Insert: {
          organization_id: string;
          company: string;
          contact_name: string;
          stage?: LeadStage;
          value_cents?: number;
          owner_id?: string | null;
          source?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      contact_submissions: {
        Row: {
          id: string;
          name: string;
          email: string;
          company: string;
          interest: string;
          message: string;
        } & Timestamps;
        Insert: { name: string; email: string; company: string; interest: string; message: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { org_role: OrgRole; lead_stage: LeadStage };
    CompositeTypes: Record<string, never>;
  };
};
