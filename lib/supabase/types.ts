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
export type ContractStatus = "draft" | "active" | "expired" | "terminated";
export type BillingCycle = "monthly" | "quarterly" | "annual" | "one_time";
export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "void";
export type Currency = "INR" | "USD" | "EUR" | "GBP";
export type AuditAction = "insert" | "update" | "delete";

type Timestamps = { created_at: string };
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
          require_mfa: boolean;
        } & Timestamps;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: string | null;
          region?: string | null;
          status?: OrgStatus;
          require_mfa?: boolean;
        };
        Update: {
          name?: string;
          slug?: string;
          plan?: string | null;
          region?: string | null;
          status?: OrgStatus;
          require_mfa?: boolean;
        };
        Relationships: [];
      };
      memberships: {
        Row: { organization_id: string; user_id: string; role: OrgRole } & Timestamps;
        Insert: { organization_id: string; user_id: string; role?: OrgRole };
        Update: { role?: OrgRole };
        Relationships: [];
      };
      leads: {
        /** value_cents is not readable through the API; use the lead_values() function. */
        Row: {
          id: string;
          organization_id: string;
          company: string;
          contact_name: string;
          contact_email: string | null;
          stage: LeadStage;
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
          attachments: Json;
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
          attachments?: Json;
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
          attachments: Json;
        } & Timestamps;
        Insert: { ticket_id: string; body: string; internal?: boolean; attachments?: Json };
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
      contracts: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          service_line: ServiceLine;
          status: ContractStatus;
          start_date: string | null;
          end_date: string | null;
          billing_cycle: BillingCycle;
          currency: Currency;
          monthly_value_cents: number;
          notes: string | null;
          document_path: string | null;
          created_by: string | null;
          updated_at: string;
        } & Timestamps;
        Insert: {
          organization_id: string;
          title: string;
          service_line?: ServiceLine;
          status?: ContractStatus;
          start_date?: string | null;
          end_date?: string | null;
          billing_cycle?: BillingCycle;
          currency?: Currency;
          monthly_value_cents?: number;
          notes?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["contracts"]["Insert"], "organization_id">> & {
          document_path?: string | null;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          organization_id: string;
          contract_id: string | null;
          number: string | null;
          issue_date: string | null;
          due_date: string | null;
          currency: Currency;
          subtotal_cents: number;
          tax_rate_bps: number;
          tax_cents: number;
          total_cents: number;
          status: InvoiceStatus;
          issued_at: string | null;
          paid_at: string | null;
          payment_reference: string | null;
          pdf_path: string | null;
          bill_to: string | null;
          notes: string | null;
          created_by: string | null;
          updated_at: string;
        } & Timestamps;
        Insert: {
          organization_id: string;
          contract_id?: string | null;
          due_date?: string | null;
          currency?: Currency;
          tax_rate_bps?: number;
          bill_to?: string | null;
          notes?: string | null;
        };
        Update: {
          contract_id?: string | null;
          due_date?: string | null;
          currency?: Currency;
          tax_rate_bps?: number;
          bill_to?: string | null;
          notes?: string | null;
          status?: InvoiceStatus;
          paid_at?: string | null;
          payment_reference?: string | null;
          pdf_path?: string | null;
        };
        Relationships: [];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          organization_id: string;
          description: string;
          quantity: number;
          unit_price_cents: number;
          amount_cents: number;
          sort_order: number;
        } & Timestamps;
        Insert: { invoice_id: string; description: string; quantity: number; unit_price_cents: number; sort_order?: number };
        Update: { description?: string; quantity?: number; unit_price_cents?: number; sort_order?: number };
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: number;
          occurred_at: string;
          actor_id: string | null;
          organization_id: string | null;
          table_name: string;
          record_id: string | null;
          action: AuditAction;
          changed_columns: string[];
          old: Json | null;
          new: Json | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      security_settings: {
        Row: { id: boolean; require_staff_mfa: boolean; updated_at: string; updated_by: string | null };
        Insert: never;
        Update: { require_staff_mfa?: boolean };
        Relationships: [];
      };
      auth_rate_limits: {
        Row: { bucket: string; window_start: string; hits: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          organization_id: string;
          author_id: string | null;
          author_kind: TicketAuthorKind;
          body: string;
          attachments: Json;
        } & Timestamps;
        Insert: { organization_id: string; body: string; attachments?: Json };
        Update: never;
        Relationships: [];
      };
      chat_reads: {
        Row: { user_id: string; organization_id: string; last_read_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      device_tokens: {
        Row: { token: string; user_id: string; platform: "ios" | "android"; created_at: string; updated_at: string };
        Insert: never;
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
      sla_targets: {
        Args: { p_org: string; p_priority: TicketPriority };
        Returns: { first_response_minutes: number; resolution_minutes: number }[];
      };
      staff_names: { Args: { p_ids: string[] }; Returns: { user_id: string; full_name: string | null }[] };
      billing_today: { Args: Record<string, never>; Returns: string };
      can_view_billing: { Args: { org: string }; Returns: boolean };
      can_read_billing_object: { Args: { p_name: string }; Returns: boolean };
      replace_invoice_items: { Args: { p_invoice: string; p_items: Json }; Returns: number };
      mark_overdue_invoices: { Args: Record<string, never>; Returns: number };
      lead_values: { Args: { p_org: string }; Returns: { id: string; stage: LeadStage; value_cents: number }[] };
      auth_rate_limit_hit: { Args: { p_bucket: string; p_window_seconds: number; p_max: number }; Returns: boolean };
      chat_unread_counts: { Args: Record<string, never>; Returns: { organization_id: string; unread: number }[] };
      attachment_in_use: { Args: { p_path: string }; Returns: boolean };
      stale_attachments: { Args: { p_older_than?: string; p_limit?: number }; Returns: string[] };
      chat_conversations: {
        Args: Record<string, never>;
        Returns: {
          organization_id: string;
          organization_name: string;
          last_body: string;
          last_author_kind: TicketAuthorKind;
          last_at: string;
        }[];
      };
      chat_mark_read: { Args: { p_org: string }; Returns: undefined };
      register_device_token: { Args: { p_token: string; p_platform: "ios" | "android" }; Returns: undefined };
      unregister_device_token: { Args: { p_token: string }; Returns: undefined };
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
      contract_status: ContractStatus;
      billing_cycle: BillingCycle;
      invoice_status: InvoiceStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
