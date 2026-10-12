export type OrgRole = "owner" | "admin" | "manager" | "agent" | "viewer";
export type LeadStage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type StaffRole = "admin" | "manager" | "agent";
export type OrgStatus = "active" | "onboarding" | "paused";
export type EnquiryStatus = "new" | "in_progress" | "closed";
export type InvitationKind = "client" | "staff";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketStatus = "open" | "pending_client" | "in_progress" | "resolved" | "closed";
export type TicketChannel = "chat" | "email" | "phone" | "portal";
export type TicketAuthorKind = "client" | "staff";
export type EngagementStatus = "planning" | "active" | "on_hold" | "completed";
export type ServiceLine = "backend" | "support" | "software" | "other";
export type MilestoneStatus = "pending" | "in_progress" | "done" | "blocked";
export type ReportStatus = "draft" | "published";

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
      sla_policies: {
        Row: {
          organization_id: string;
          priority: TicketPriority;
          first_response_minutes: number | null;
          resolution_minutes: number | null;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          priority: TicketPriority;
          first_response_minutes?: number | null;
          resolution_minutes?: number | null;
        };
        Update: { first_response_minutes?: number | null; resolution_minutes?: number | null };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          organization_id: string;
          reference: string;
          subject: string;
          description: string;
          priority: TicketPriority;
          status: TicketStatus;
          channel: TicketChannel;
          requester_name: string | null;
          requester_email: string | null;
          created_by: string | null;
          assigned_to: string | null;
          first_response_at: string | null;
          resolved_at: string | null;
          sla_first_response_minutes: number;
          sla_resolution_minutes: number;
          updated_at: string;
        } & Timestamps;
        Insert: {
          organization_id: string;
          subject: string;
          description: string;
          priority?: TicketPriority;
          status?: TicketStatus;
          channel?: TicketChannel;
          requester_name?: string | null;
          requester_email?: string | null;
          assigned_to?: string | null;
          sla_first_response_minutes?: number | null;
          sla_resolution_minutes?: number | null;
        };
        Update: {
          subject?: string;
          description?: string;
          priority?: TicketPriority;
          status?: TicketStatus;
          channel?: TicketChannel;
          requester_name?: string | null;
          requester_email?: string | null;
          assigned_to?: string | null;
          sla_first_response_minutes?: number;
          sla_resolution_minutes?: number;
        };
        Relationships: [];
      };
      ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          organization_id: string;
          author_id: string | null;
          author_kind: TicketAuthorKind;
          body: string;
          internal: boolean;
        } & Timestamps;
        Insert: { ticket_id: string; body: string; internal?: boolean };
        Update: never;
        Relationships: [];
      };
      engagements: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          service_line: ServiceLine;
          status: EngagementStatus;
          start_date: string | null;
          end_date: string | null;
          owner_staff_id: string | null;
          summary: string | null;
          updated_at: string;
        } & Timestamps;
        Insert: {
          organization_id: string;
          name: string;
          service_line?: ServiceLine;
          status?: EngagementStatus;
          start_date?: string | null;
          end_date?: string | null;
          owner_staff_id?: string | null;
          summary?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["engagements"]["Insert"], "organization_id">>;
        Relationships: [];
      };
      milestones: {
        Row: {
          id: string;
          engagement_id: string;
          organization_id: string;
          title: string;
          due_date: string | null;
          status: MilestoneStatus;
          completed_at: string | null;
          sort_order: number;
          updated_at: string;
        } & Timestamps;
        Insert: {
          engagement_id: string;
          title: string;
          due_date?: string | null;
          status?: MilestoneStatus;
          sort_order?: number;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["milestones"]["Insert"], "engagement_id">>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          organization_id: string;
          engagement_id: string | null;
          title: string;
          period_start: string | null;
          period_end: string | null;
          summary: string | null;
          body: string;
          status: ReportStatus;
          published_at: string | null;
          published_by: string | null;
          created_by: string | null;
          updated_at: string;
        } & Timestamps;
        Insert: {
          organization_id: string;
          engagement_id?: string | null;
          title: string;
          period_start?: string | null;
          period_end?: string | null;
          summary?: string | null;
          body?: string;
          status?: ReportStatus;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["reports"]["Insert"], "organization_id">>;
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
      sla_targets: {
        Args: { p_org: string; p_priority: TicketPriority };
        Returns: { first_response_minutes: number; resolution_minutes: number }[];
      };
      staff_names: { Args: { p_ids: string[] }; Returns: { user_id: string; full_name: string | null }[] };
    };
    Enums: {
      org_role: OrgRole;
      lead_stage: LeadStage;
      staff_role: StaffRole;
      ticket_priority: TicketPriority;
      ticket_status: TicketStatus;
      engagement_status: EngagementStatus;
      milestone_status: MilestoneStatus;
      report_status: ReportStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
