-- Largis Venture — service delivery: engagements, milestones, and client reports.
-- Applies on top of 0001–0004. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.engagement_status as enum ('planning', 'active', 'on_hold', 'completed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.milestone_status as enum ('pending', 'in_progress', 'done', 'blocked');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_status as enum ('draft', 'published');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.engagements (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 160),
  service_line     text not null default 'other' check (service_line in ('backend', 'support', 'software', 'other')),
  status           public.engagement_status not null default 'planning',
  start_date       date,
  end_date         date,
  owner_staff_id   uuid references auth.users (id) on delete set null,
  summary          text check (char_length(summary) <= 5000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint engagements_dates_check check (start_date is null or end_date is null or end_date >= start_date)
);

create index if not exists engagements_org_idx on public.engagements (organization_id, status);

create table if not exists public.milestones (
  id               uuid primary key default gen_random_uuid(),
  engagement_id    uuid not null references public.engagements (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  title            text not null check (char_length(title) between 2 and 200),
  due_date         date,
  status           public.milestone_status not null default 'pending',
  completed_at     timestamptz,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists milestones_engagement_idx on public.milestones (engagement_id, sort_order, due_date);
create index if not exists milestones_org_due_idx on public.milestones (organization_id, due_date);

create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  engagement_id    uuid references public.engagements (id) on delete set null,
  title            text not null check (char_length(title) between 2 and 200),
  period_start     date,
  period_end       date,
  summary          text check (char_length(summary) <= 2000),
  body             text not null default '' check (char_length(body) <= 100000),
  status           public.report_status not null default 'draft',
  published_at     timestamptz,
  published_by     uuid references auth.users (id) on delete set null,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint reports_period_check check (period_start is null or period_end is null or period_end >= period_start)
);

create index if not exists reports_org_status_idx on public.reports (organization_id, status, published_at desc);
create index if not exists reports_engagement_idx on public.reports (engagement_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.engagements_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'An engagement cannot move to another client' using errcode = 'P0001';
  end if;
  if new.owner_staff_id is not null
     and (tg_op = 'INSERT' or new.owner_staff_id is distinct from old.owner_staff_id)
     and not exists (select 1 from public.staff_members where user_id = new.owner_staff_id and active)
  then
    raise exception 'The engagement owner must be an active Largis staff member' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists engagements_before_write on public.engagements;
create trigger engagements_before_write
before insert or update on public.engagements
for each row execute function public.engagements_before_write();

-- Milestones inherit their engagement's organization; completed_at follows the status.
create or replace function public.milestones_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  engagement_org uuid;
begin
  select organization_id into engagement_org from public.engagements where id = new.engagement_id;
  if engagement_org is null then
    raise exception 'That engagement does not exist' using errcode = '23503';
  end if;
  new.organization_id := engagement_org;

  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status <> 'done' then
      new.completed_at := now();
    else
      new.completed_at := coalesce(old.completed_at, now());
    end if;
  else
    new.completed_at := null;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists milestones_before_write on public.milestones;
create trigger milestones_before_write
before insert or update on public.milestones
for each row execute function public.milestones_before_write();

-- Publishing stamps who and when; returning a report to draft clears both.
create or replace function public.reports_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'A report cannot move to another client' using errcode = 'P0001';
  end if;
  if new.engagement_id is not null
     and not exists (
       select 1 from public.engagements where id = new.engagement_id and organization_id = new.organization_id
     )
  then
    raise exception 'The engagement belongs to a different client' using errcode = 'P0001';
  end if;

  if new.status = 'published' then
    if tg_op = 'INSERT' or old.status <> 'published' then
      new.published_at := now();
      new.published_by := auth.uid();
    else
      new.published_at := old.published_at;
      new.published_by := old.published_by;
    end if;
  else
    new.published_at := null;
    new.published_by := null;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists reports_before_write on public.reports;
create trigger reports_before_write
before insert or update on public.reports
for each row execute function public.reports_before_write();

-- ---------------------------------------------------------------------------
-- Row Level Security: clients read; only staff write
-- ---------------------------------------------------------------------------

alter table public.engagements enable row level security;
alter table public.milestones  enable row level security;
alter table public.reports     enable row level security;

drop policy if exists "engagements_select" on public.engagements;
create policy "engagements_select" on public.engagements
  for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

drop policy if exists "engagements_staff_all" on public.engagements;
create policy "engagements_staff_all" on public.engagements
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "milestones_select" on public.milestones;
create policy "milestones_select" on public.milestones
  for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

drop policy if exists "milestones_staff_all" on public.milestones;
create policy "milestones_staff_all" on public.milestones
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Clients never see drafts.
drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports
  for select to authenticated
  using (public.is_staff() or (status = 'published' and public.is_org_member(organization_id)));

drop policy if exists "reports_staff_all" on public.reports;
create policy "reports_staff_all" on public.reports
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Grants (this project does not auto-grant; see 0002)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.engagements to authenticated;
grant select, insert, update, delete on public.milestones  to authenticated;
grant select, insert, update, delete on public.reports     to authenticated;

revoke all on function public.engagements_before_write() from public, anon, authenticated;
revoke all on function public.milestones_before_write()  from public, anon, authenticated;
revoke all on function public.reports_before_write()     from public, anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';
