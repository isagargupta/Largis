-- Largis Venture — support desk: tickets, conversation threads, and SLA targets.
-- Applies on top of 0001–0003. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.ticket_status as enum ('open', 'pending_client', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Per-client overrides; a null column falls back to the global default in sla_targets().
create table if not exists public.sla_policies (
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  priority                public.ticket_priority not null,
  first_response_minutes  integer check (first_response_minutes between 1 and 525600),
  resolution_minutes      integer check (resolution_minutes between 1 and 525600),
  updated_at              timestamptz not null default now(),
  primary key (organization_id, priority)
);

create sequence if not exists public.support_ticket_number_seq start with 1001;

create table if not exists public.support_tickets (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null references public.organizations (id) on delete cascade,
  reference                   text not null unique default ('LV-' || nextval('public.support_ticket_number_seq')::text),
  subject                     text not null check (char_length(subject) between 3 and 200),
  description                 text not null check (char_length(description) between 1 and 10000),
  priority                    public.ticket_priority not null default 'normal',
  status                      public.ticket_status not null default 'open',
  channel                     text not null default 'portal' check (channel in ('chat', 'email', 'phone', 'portal')),
  requester_name              text check (char_length(requester_name) <= 120),
  requester_email             text check (char_length(requester_email) <= 254),
  created_by                  uuid references auth.users (id) on delete set null default auth.uid(),
  assigned_to                 uuid references auth.users (id) on delete set null,
  first_response_at           timestamptz,
  resolved_at                 timestamptz,
  sla_first_response_minutes  integer not null check (sla_first_response_minutes between 1 and 525600),
  sla_resolution_minutes      integer not null check (sla_resolution_minutes between 1 and 525600),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter sequence public.support_ticket_number_seq owned by public.support_tickets.reference;

create index if not exists support_tickets_org_created_idx on public.support_tickets (organization_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_assignee_idx on public.support_tickets (assigned_to);

create table if not exists public.ticket_messages (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references public.support_tickets (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  author_id        uuid references auth.users (id) on delete set null default auth.uid(),
  author_kind      text not null check (author_kind in ('client', 'staff')),
  body             text not null check (char_length(body) between 1 and 10000),
  internal         boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);
create index if not exists ticket_messages_org_idx on public.ticket_messages (organization_id);

-- ---------------------------------------------------------------------------
-- Functions and triggers
-- ---------------------------------------------------------------------------

-- Effective SLA targets for a client and priority. Runs with the caller's rights, so clients only
-- see their own organization's overrides.
create or replace function public.sla_targets(
  p_org uuid,
  p_priority public.ticket_priority,
  out first_response_minutes integer,
  out resolution_minutes integer
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(p.first_response_minutes, d.first_response_minutes),
    coalesce(p.resolution_minutes, d.resolution_minutes)
  from (
    select
      case p_priority when 'urgent' then 15 when 'high' then 60 when 'normal' then 240 else 480 end as first_response_minutes,
      case p_priority when 'urgent' then 240 when 'high' then 480 when 'normal' then 1440 else 2880 end as resolution_minutes
  ) d
  left join public.sla_policies p on p.organization_id = p_org and p.priority = p_priority
$$;

-- Display names of Largis staff (never their email addresses) so clients can see who is helping them.
create or replace function public.staff_names(p_ids uuid[])
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, p.full_name
  from public.staff_members s
  join public.profiles p on p.id = s.user_id
  where s.user_id = any (p_ids) and auth.uid() is not null
$$;

-- Clients may open tickets and mark them resolved or reopen them; everything else is staff-managed.
-- pg_trigger_depth() = 1 exempts updates made by the ticket_messages trigger below.
create or replace function public.support_tickets_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_client boolean := auth.uid() is not null and not public.is_staff() and pg_trigger_depth() = 1;
  targets record;
begin
  if is_client then
    if tg_op = 'INSERT' then
      if new.assigned_to is not null
         or new.status <> 'open'
         or new.channel <> 'portal'
         or new.sla_first_response_minutes is not null
         or new.sla_resolution_minutes is not null
      then
        raise exception 'Only Largis staff can set the assignee, status, channel, or SLA targets' using errcode = '42501';
      end if;
      new.created_by := auth.uid();
    else
      if (new.subject, new.description, new.priority, new.channel, new.requester_name, new.requester_email,
          new.assigned_to, new.sla_first_response_minutes, new.sla_resolution_minutes)
         is distinct from
         (old.subject, old.description, old.priority, old.channel, old.requester_name, old.requester_email,
          old.assigned_to, old.sla_first_response_minutes, old.sla_resolution_minutes)
      then
        raise exception 'Only Largis staff can change ticket details' using errcode = '42501';
      end if;
      if new.status is distinct from old.status and not (
           (new.status = 'resolved' and old.status in ('open', 'pending_client', 'in_progress'))
           or (new.status = 'open' and old.status in ('resolved', 'closed'))
         )
      then
        raise exception 'You can mark a ticket resolved or reopen it; other status changes are made by Largis staff'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and not exists (select 1 from public.staff_members where user_id = new.assigned_to and active)
  then
    raise exception 'Tickets can only be assigned to active Largis staff' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    select * into targets from public.sla_targets(new.organization_id, new.priority);
    new.sla_first_response_minutes := coalesce(new.sla_first_response_minutes, targets.first_response_minutes);
    new.sla_resolution_minutes := coalesce(new.sla_resolution_minutes, targets.resolution_minutes);
    new.first_response_at := null;
  elsif new.priority is distinct from old.priority then
    select * into targets from public.sla_targets(new.organization_id, new.priority);
    if new.sla_first_response_minutes = old.sla_first_response_minutes then
      new.sla_first_response_minutes := targets.first_response_minutes;
    end if;
    if new.sla_resolution_minutes = old.sla_resolution_minutes then
      new.sla_resolution_minutes := targets.resolution_minutes;
    end if;
  end if;

  if new.status in ('resolved', 'closed') then
    if tg_op = 'INSERT' or old.status not in ('resolved', 'closed') then
      new.resolved_at := now();
    else
      new.resolved_at := coalesce(old.resolved_at, now());
    end if;
  else
    new.resolved_at := null;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists support_tickets_before_write on public.support_tickets;
create trigger support_tickets_before_write
before insert or update on public.support_tickets
for each row execute function public.support_tickets_before_write();

-- Messages inherit the ticket's organization; the author is always the signed-in user.
create or replace function public.ticket_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_org uuid;
begin
  select organization_id into ticket_org from public.support_tickets where id = new.ticket_id;
  if ticket_org is null then
    raise exception 'That ticket does not exist' using errcode = '23503';
  end if;
  new.organization_id := ticket_org;

  if auth.uid() is not null then
    new.author_id := auth.uid();
    new.author_kind := case when public.is_staff() then 'staff' else 'client' end;
  end if;
  if new.author_kind = 'client' and new.internal then
    raise exception 'Internal notes are for Largis staff only' using errcode = '42501';
  end if;

  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists ticket_messages_before_insert on public.ticket_messages;
create trigger ticket_messages_before_insert
before insert on public.ticket_messages
for each row execute function public.ticket_messages_before_insert();

-- The first public staff reply stamps first_response_at; a client reply reopens a waiting or resolved ticket.
create or replace function public.ticket_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets t
  set
    first_response_at = case
      when new.author_kind = 'staff' and not new.internal then coalesce(t.first_response_at, new.created_at)
      else t.first_response_at
    end,
    status = case
      when new.author_kind = 'client' and t.status = 'pending_client' then 'in_progress'::public.ticket_status
      when new.author_kind = 'client' and t.status in ('resolved', 'closed') then 'open'::public.ticket_status
      else t.status
    end
  where t.id = new.ticket_id;
  return null;
end;
$$;

drop trigger if exists ticket_messages_after_insert on public.ticket_messages;
create trigger ticket_messages_after_insert
after insert on public.ticket_messages
for each row execute function public.ticket_messages_after_insert();

drop trigger if exists sla_policies_touch_updated_at on public.sla_policies;
create trigger sla_policies_touch_updated_at
before update on public.sla_policies
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.sla_policies    enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;

drop policy if exists "sla_policies_select" on public.sla_policies;
create policy "sla_policies_select" on public.sla_policies
  for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

drop policy if exists "sla_policies_staff_all" on public.sla_policies;
create policy "sla_policies_staff_all" on public.sla_policies
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Tickets: every member reads; viewers are read-only; column and transition limits live in the trigger.
drop policy if exists "tickets_select" on public.support_tickets;
create policy "tickets_select" on public.support_tickets
  for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

drop policy if exists "tickets_client_insert" on public.support_tickets;
create policy "tickets_client_insert" on public.support_tickets
  for insert to authenticated
  with check (public.org_role_for(organization_id) in ('owner', 'admin', 'manager', 'agent'));

drop policy if exists "tickets_client_update" on public.support_tickets;
create policy "tickets_client_update" on public.support_tickets
  for update to authenticated
  using (public.org_role_for(organization_id) in ('owner', 'admin', 'manager', 'agent'))
  with check (public.org_role_for(organization_id) in ('owner', 'admin', 'manager', 'agent'));

drop policy if exists "tickets_staff_all" on public.support_tickets;
create policy "tickets_staff_all" on public.support_tickets
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Messages: internal notes never reach clients.
drop policy if exists "ticket_messages_select" on public.ticket_messages;
create policy "ticket_messages_select" on public.ticket_messages
  for select to authenticated
  using (public.is_staff() or (not internal and public.is_org_member(organization_id)));

drop policy if exists "ticket_messages_client_insert" on public.ticket_messages;
create policy "ticket_messages_client_insert" on public.ticket_messages
  for insert to authenticated
  with check (
    not internal
    and author_id = auth.uid()
    and public.org_role_for(organization_id) in ('owner', 'admin', 'manager', 'agent')
  );

drop policy if exists "ticket_messages_staff_all" on public.ticket_messages;
create policy "ticket_messages_staff_all" on public.ticket_messages
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Grants (this project does not auto-grant; see 0002)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.sla_policies to authenticated;

-- Reference, timestamps, and response tracking are maintained by triggers only.
grant select, delete on public.support_tickets to authenticated;
grant insert (
  organization_id, subject, description, priority, status, channel, requester_name, requester_email,
  assigned_to, sla_first_response_minutes, sla_resolution_minutes
) on public.support_tickets to authenticated;
grant update (
  subject, description, priority, status, channel, requester_name, requester_email,
  assigned_to, sla_first_response_minutes, sla_resolution_minutes
) on public.support_tickets to authenticated;
grant usage on sequence public.support_ticket_number_seq to authenticated;

-- Messages are an audit trail: no edits or deletes through the API.
grant select on public.ticket_messages to authenticated;
grant insert (ticket_id, body, internal) on public.ticket_messages to authenticated;

revoke all on function public.sla_targets(uuid, public.ticket_priority) from public, anon;
revoke all on function public.staff_names(uuid[])                       from public, anon;
revoke all on function public.support_tickets_before_write()            from public, anon, authenticated;
revoke all on function public.ticket_messages_before_insert()           from public, anon, authenticated;
revoke all on function public.ticket_messages_after_insert()            from public, anon, authenticated;

grant execute on function public.sla_targets(uuid, public.ticket_priority) to authenticated;
grant execute on function public.staff_names(uuid[])                       to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';
