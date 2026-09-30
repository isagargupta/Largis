-- Largis Venture — multi-tenant schema with Row Level Security.
-- Every tenant-owned table carries organization_id; access is granted only via memberships.

create extension if not exists "pgcrypto";

create type public.org_role as enum ('owner', 'admin', 'manager', 'agent', 'viewer');
create type public.lead_stage as enum ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.org_role not null default 'viewer',
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);

create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  company          text not null,
  contact_name     text not null,
  stage            public.lead_stage not null default 'new',
  value_cents      bigint not null default 0 check (value_cents >= 0),
  owner_id         uuid references auth.users (id) on delete set null,
  source           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index leads_org_stage_idx on public.leads (organization_id, stage);
create index leads_owner_idx on public.leads (owner_id);

-- Public marketing enquiries (not tenant-scoped; insert-only for anonymous users).
create table public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  email       text not null check (char_length(email) <= 254),
  company     text not null check (char_length(company) between 2 and 160),
  interest    text not null,
  message     text not null check (char_length(message) between 20 and 5000),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer avoids recursive RLS on memberships)
-- ---------------------------------------------------------------------------

create or replace function public.org_role_for(org uuid)
returns public.org_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.memberships
  where organization_id = org and user_id = auth.uid()
$$;

create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.org_role_for(org) is not null
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_touch_updated_at
before update on public.leads
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations       enable row level security;
alter table public.memberships         enable row level security;
alter table public.leads               enable row level security;
alter table public.contact_submissions enable row level security;

-- Organizations: members can read; owners/admins can update.
create policy "org_select_members" on public.organizations
  for select using (public.is_org_member(id));

create policy "org_update_admins" on public.organizations
  for update using (public.org_role_for(id) in ('owner', 'admin'));

-- Memberships: members see their org roster; owners/admins manage it.
create policy "membership_select_members" on public.memberships
  for select using (public.is_org_member(organization_id));

create policy "membership_manage_admins" on public.memberships
  for all using (public.org_role_for(organization_id) in ('owner', 'admin'))
  with check (public.org_role_for(organization_id) in ('owner', 'admin'));

-- Leads: tenant isolation + role scoping. Agents only see/modify leads assigned to them.
create policy "leads_select" on public.leads
  for select using (
    public.org_role_for(organization_id) in ('owner', 'admin', 'manager', 'viewer')
    or (public.org_role_for(organization_id) = 'agent' and owner_id = auth.uid())
  );

create policy "leads_insert" on public.leads
  for insert with check (
    public.org_role_for(organization_id) in ('owner', 'admin', 'manager', 'agent')
  );

create policy "leads_update" on public.leads
  for update using (
    public.org_role_for(organization_id) in ('owner', 'admin', 'manager')
    or (public.org_role_for(organization_id) = 'agent' and owner_id = auth.uid())
  )
  with check (public.is_org_member(organization_id));

create policy "leads_delete" on public.leads
  for delete using (public.org_role_for(organization_id) in ('owner', 'admin'));

-- Contact submissions: anyone may insert; nobody may read via the API.
create policy "contact_insert_anyone" on public.contact_submissions
  for insert to anon, authenticated with check (true);
