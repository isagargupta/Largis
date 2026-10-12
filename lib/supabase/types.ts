export type OrgRole = "owner" | "admin" | "manager" | "agent" | "viewer";
export type LeadStage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type StaffRole = "admin" | "manager" | "agent";
export type OrgStatus = "active" | "onboarding" | "paused";
export type EnquiryStatus = "new" | "in_progress" | "closed";
export type InvitationKind = "client" | "staff";

type Timestamps = { created_at: string };
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: string | null;
          region: string | null;
          status: OrgStatus;
        } & Timestamps;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: string | null;
          region?: string | null;
          status?: OrgStatus;
        };
        Update: { name?: string; slug?: string; plan?: string | null; region?: string | null; status?: OrgStatus };
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
          contact_email: string | null;
          stage: LeadStage;
          value_cents: number;
          owner_id: string | null;
          source: string | null;
          notes: string | null;
          updated_at: string;
        } & Timestamps;
        Insert: {
          organization_id: string;
          company: string;
          contact_name: string;
          contact_email?: string | null;
          stage?: LeadStage;
          value_cents?: number;
          owner_id?: string | null;
          source?: string | null;
          notes?: string | null;
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
          status: EnquiryStatus;
          assigned_to: string | null;
          internal_notes: string | null;
          updated_at: string;
        } & Timestamps;
        Insert: { name: string; email: string; company: string; interest: string; message: string };
        Update: { status?: EnquiryStatus; assigned_to?: string | null; internal_notes?: string | null };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; email: string | null; full_name: string | null } & Timestamps;
        Insert: { id: string; email?: string | null; full_name?: string | null };
        Update: { full_name?: string | null };
        Relationships: [];
      };
      staff_members: {
        Row: { user_id: string; role: StaffRole; title: string | null; active: boolean } & Timestamps;
        Insert: { user_id: string; role?: StaffRole; title?: string | null; active?: boolean };
        Update: { role?: StaffRole; title?: string | null; active?: boolean };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          kind: InvitationKind;
          email: string;
          full_name: string | null;
          organization_id: string | null;
          org_role: OrgRole | null;
          staff_role: StaffRole | null;
          title: string | null;
          invited_by: string | null;
          accepted_at: string | null;
          revoked_at: string | null;
        } & Timestamps;
        Insert: {
          kind: InvitationKind;
          email: string;
          full_name?: string | null;
          organization_id?: string | null;
          org_role?: OrgRole | null;
          staff_role?: StaffRole | null;
          title?: string | null;
        };
        Update: { revoked_at?: string | null };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          organization_id: string | null;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          metadata: Json;
        } & Timestamps;
        Insert: {
          organization_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          metadata?: Json;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      org_role_for: { Args: { org: string }; Returns: OrgRole | null };
      is_org_member: { Args: { org: string }; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      staff_role_for_me: { Args: Record<string, never>; Returns: StaffRole | null };
      shares_org_with: { Args: { other: string }; Returns: boolean };
      accept_pending_invitations: { Args: Record<string, never>; Returns: number };
      apply_invitations_for: { Args: { p_user: string; p_email: string }; Returns: number };
    };
    Enums: { org_role: OrgRole; lead_stage: LeadStage; staff_role: StaffRole };
    CompositeTypes: Record<string, never>;
  };
};
