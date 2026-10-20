-- RevenueDesk: add the Contacted stage on its own.
-- Postgres will not let a new enum value be used until the transaction that adds it has committed,
-- so the tables that reference 'contacted' live in 0016.

alter type public.lead_stage add value if not exists 'contacted' after 'new';
