-- Largis Venture — client and staff portals.
-- Applies on top of 0001_init.sql and 0002_api_grants.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.staff_role as enum ('admin', 'manager', 'agent');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text check (char_length(full_name) <= 120),
  created_at  timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

create table if not exists public.staff_members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.staff_role not null default 'agent',
  title       text check (char_length(title) <= 120),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.invitations (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('client', 'staff')),
  email            text not null check (email = lower(email) and char_length(email) <= 254),
  full_name        text check (char_length(full_name) <= 120),
  organization_id  uuid references public.organizations (id) on delete cascade,
  org_role         public.org_role,
  staff_role       public.staff_role,
  title            text check (char_length(title) <= 120),
  invited_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  revoked_at       timestamptz,
  constraint invitations_kind_shape check (
    (kind = 'client' and organization_id is not null and org_role is not null and staff_role is null)
    or (kind = 'staff' and organization_id is null and staff_role is not null and org_role is null)
  )
);

-- One pending invitation per person per organization (or per staff directory).
create unique index if not exists invitations_pending_unique on public.invitations (
  kind, email, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
) where accepted_at is null and revoked_at is null;

create index if not exists invitations_org_idx on public.invitations (organization_id);
create index if not exists invitations_email_idx on public.invitations (email);

create table if not exists public.activity_log (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations (id) on delete cascade,
  actor_id         uuid references auth.users (id) on delete set null default auth.uid(),
  action           text not null check (char_length(action) <= 80),
  entity           text not null check (char_length(entity) <= 80),
  entity_id        uuid,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists activity_log_org_created_idx on public.activity_log (organization_id, created_at desc);
create index if not exists activity_log_created_idx on public.activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Columns on existing tables
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists plan   text,
  add column if not exists region text,
  add column if not exists status text not null default 'active';

do $$
begin
  alter table public.organizations
    add constraint organizations_status_check check (status in ('active', 'onboarding', 'paused'));
exception when duplicate_object then null;
end $$;

alter table public.leads
  add column if not exists contact_email text check (char_length(contact_email) <= 254),
  add column if not exists notes         text check (char_length(notes) <= 5000);

alter table public.contact_submissions
  add column if not exists status         text not null default 'new',
  add column if not exists assigned_to    uuid references auth.users (id) on delete set null,
  add column if not exists internal_notes text check (char_length(internal_notes) <= 10000),
  add column if not exists updated_at     timestamptz not null default now();

do $$
begin
  alter table public.contact_submissions
    add constraint contact_submissions_status_check check (status in ('new', 'in_progress', 'closed'));
exception when duplicate_object then null;
end $$;

create index if not exists contact_submissions_status_idx on public.contact_submissions (status, created_at desc);

drop trigger if exists contact_submissions_touch_updated_at on public.contact_submissions;
create trigger contact_submissions_touch_updated_at
before update on public.contact_submissions
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions (security definer avoids recursive RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_members where user_id = auth.uid() and active
  )
$$;

create or replace function public.staff_role_for_me()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.staff_members where user_id = auth.uid() and active
$$;

create or replace function public.shares_org_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  )
$$;

-- Turns every pending invitation for an email into a membership or staff row.
create or replace function public.apply_invitations_for(p_user uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations%rowtype;
  applied integer := 0;
begin
  if p_user is null or p_email is null then
    return 0;
  end if;

  -- Lets guard_membership_change accept an invited owner joining an organization.
  perform set_config('largis.applying_invitations', 'on', true);

  for inv in
    select * from public.invitations
    where email = lower(p_email) and accepted_at is null and revoked_at is null
    for update
  loop
    if inv.kind = 'client' then
      insert into public.memberships (organization_id, user_id, role)
      values (inv.organization_id, p_user, inv.org_role)
      on conflict (organization_id, user_id) do nothing;
    else
      insert into public.staff_members (user_id, role, title, active)
      values (p_user, inv.staff_role, inv.title, true)
      on conflict (user_id) do update
        set role = excluded.role,
            title = coalesce(excluded.title, public.staff_members.title),
            active = true;
    end if;

    if inv.full_name is not null then
      update public.profiles set full_name = inv.full_name where id = p_user and full_name is null;
    end if;

    update public.invitations set accepted_at = now() where id = inv.id;

    insert into public.activity_log (organization_id, actor_id, action, entity, entity_id, metadata)
    values (inv.organization_id, p_user, 'invitation.accepted', 'invitation', inv.id,
            jsonb_build_object('email', inv.email, 'kind', inv.kind));

    applied := applied + 1;
  end loop;

  return applied;
end;
$$;

-- Called by the app after a successful sign-in.
create or replace function public.accept_pending_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select email into v_email
  from auth.users
  where id = auth.uid() and email_confirmed_at is not null;

  return public.apply_invitations_for(auth.uid(), v_email);
end;
$$;

create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;

  -- Invitations are only honoured once the address is proven.
  if new.email is not null and new.email_confirmed_at is not null then
    perform public.apply_invitations_for(new.id, new.email);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_change();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email, email_confirmed_at on auth.users
for each row
when (old.email is distinct from new.email or old.email_confirmed_at is distinct from new.email_confirmed_at)
execute function public.handle_auth_user_change();

-- An organization always keeps at least one owner (cascading deletes are exempt).
create or replace function public.guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.organizations where id = old.organization_id)
     and exists (select 1 from auth.users where id = old.user_id)
     and not exists (
       select 1 from public.memberships
       where organization_id = old.organization_id and role = 'owner' and user_id <> old.user_id
     )
  then
    raise exception 'An organization must keep at least one owner' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_guard_last_owner on public.memberships;
create trigger memberships_guard_last_owner
before update or delete on public.memberships
for each row execute function public.guard_last_owner();

-- The 0001 policies let client admins manage memberships; only owners (or staff) may touch the Owner role.
create or replace function public.guard_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
  touches_owner boolean := false;
begin
  if tg_op = 'DELETE' then
    org := old.organization_id;
  else
    org := new.organization_id;
    if new.role = 'owner' then
      touches_owner := true;
    end if;
  end if;
  if tg_op <> 'INSERT' then
    if old.role = 'owner' then
      touches_owner := true;
    end if;
  end if;

  if touches_owner
     and auth.uid() is not null
     and not public.is_staff()
     and coalesce(current_setting('largis.applying_invitations', true), '') <> 'on'
     and public.org_role_for(org) is distinct from 'owner'
  then
    raise exception 'Only an owner can grant, change, or remove the Owner role' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_guard_owner_role on public.memberships;
create trigger memberships_guard_owner_role
before insert or update or delete on public.memberships
for each row execute function public.guard_membership_change();

-- Client admins may rename their organization; plan, region, status, and slug are managed by staff.
create or replace function public.guard_org_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_staff()
     and (new.slug, new.plan, new.region, new.status) is distinct from (old.slug, old.plan, old.region, old.status)
  then
    raise exception 'Only Largis staff can change the plan, region, status, or identifier' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_guard_staff_fields on public.organizations;
create trigger organizations_guard_staff_fields
before update on public.organizations
for each row execute function public.guard_org_change();

-- ---------------------------------------------------------------------------
-- Backfill and bootstrap
-- ---------------------------------------------------------------------------

insert into public.profiles (id, email, full_name, created_at)
select id, lower(email), nullif(raw_user_meta_data ->> 'full_name', ''), created_at
from auth.users
on conflict (id) do nothing;

insert into public.staff_members (user_id, role, active)
select id, 'admin', true
from auth.users
where lower(email) = 'sagar@largis.co'
on conflict (user_id) do update set role = 'admin', active = true;

insert into public.invitations (kind, email, staff_role)
select 'staff', 'sagar@largis.co', 'admin'
where not exists (
  select 1 from public.invitations
  where kind = 'staff' and email = 'sagar@largis.co' and accepted_at is null and revoked_at is null
)
and not exists (
  select 1 from public.staff_members s
  join auth.users u on u.id = s.user_id
  where lower(u.email) = 'sagar@largis.co'
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.staff_members enable row level security;
alter table public.invitations   enable row level security;
alter table public.activity_log  enable row level security;

-- Profiles: yourself, people you share an organization with, and staff.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff() or public.shares_org_with(id));

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Staff directory: readable by staff; only staff admins change it.
drop policy if exists "staff_members_select" on public.staff_members;
create policy "staff_members_select" on public.staff_members
  for select to authenticated
  using (public.is_staff() or user_id = auth.uid());

drop policy if exists "staff_members_admin_write" on public.staff_members;
create policy "staff_members_admin_write" on public.staff_members
  for all to authenticated
  using (public.staff_role_for_me() = 'admin')
  with check (public.staff_role_for_me() = 'admin');

-- Staff access to client data, alongside the client policies from 0001.
drop policy if exists "org_staff_all" on public.organizations;
create policy "org_staff_all" on public.organizations
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "membership_staff_all" on public.memberships;
create policy "membership_staff_all" on public.memberships
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "leads_staff_all" on public.leads;
create policy "leads_staff_all" on public.leads
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "contact_staff_select" on public.contact_submissions;
create policy "contact_staff_select" on public.contact_submissions
  for select to authenticated
  using (public.is_staff());

drop policy if exists "contact_staff_update" on public.contact_submissions;
create policy "contact_staff_update" on public.contact_submissions
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Invitations: staff manage client invites; only staff admins manage staff invites.
drop policy if exists "invitations_staff_all" on public.invitations;
create policy "invitations_staff_all" on public.invitations
  for all to authenticated
  using (public.is_staff() and (kind = 'client' or public.staff_role_for_me() = 'admin'))
  with check (public.is_staff() and (kind = 'client' or public.staff_role_for_me() = 'admin'));

-- Client owners/admins manage invitations to their own organization; only owners invite owners.
drop policy if exists "invitations_client_select" on public.invitations;
create policy "invitations_client_select" on public.invitations
  for select to authenticated
  using (kind = 'client' and public.org_role_for(organization_id) in ('owner', 'admin'));

drop policy if exists "invitations_client_insert" on public.invitations;
create policy "invitations_client_insert" on public.invitations
  for insert to authenticated
  with check (
    kind = 'client'
    and staff_role is null
    and public.org_role_for(organization_id) in ('owner', 'admin')
    and (org_role <> 'owner' or public.org_role_for(organization_id) = 'owner')
  );

drop policy if exists "invitations_client_revoke" on public.invitations;
create policy "invitations_client_revoke" on public.invitations
  for update to authenticated
  using (kind = 'client' and public.org_role_for(organization_id) in ('owner', 'admin'))
  with check (kind = 'client' and public.org_role_for(organization_id) in ('owner', 'admin'));

-- Activity: members read their organization's history; staff read everything.
drop policy if exists "activity_select" on public.activity_log;
create policy "activity_select" on public.activity_log
  for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

drop policy if exists "activity_insert" on public.activity_log;
create policy "activity_insert" on public.activity_log
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (public.is_staff() or public.is_org_member(organization_id))
  );

drop policy if exists "activity_staff_manage" on public.activity_log;
create policy "activity_staff_manage" on public.activity_log
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Grants (this project does not auto-grant; see 0002)
-- ---------------------------------------------------------------------------

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select, insert, update, delete on public.staff_members to authenticated;
grant select, insert, delete on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;
grant select, insert, update, delete on public.activity_log  to authenticated;

-- Staff work the enquiry inbox. Visitors may only supply the contact form fields, not triage columns.
grant select, update on public.contact_submissions to authenticated;
revoke insert on public.contact_submissions from anon, authenticated;
grant insert (name, email, company, interest, message) on public.contact_submissions to anon, authenticated;

revoke all on function public.is_staff()                         from public, anon;
revoke all on function public.staff_role_for_me()                from public, anon;
revoke all on function public.shares_org_with(uuid)              from public, anon;
revoke all on function public.accept_pending_invitations()       from public, anon;
revoke all on function public.apply_invitations_for(uuid, text)  from public, anon, authenticated;
revoke all on function public.handle_auth_user_change()          from public, anon, authenticated;
revoke all on function public.guard_last_owner()                 from public, anon, authenticated;
revoke all on function public.guard_membership_change()          from public, anon, authenticated;
revoke all on function public.guard_org_change()                 from public, anon, authenticated;

grant execute on function public.is_staff()                   to authenticated;
grant execute on function public.staff_role_for_me()          to authenticated;
grant execute on function public.shares_org_with(uuid)        to authenticated;
grant execute on function public.accept_pending_invitations() to authenticated;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Make the new tables, columns, and functions visible to the Data API immediately.
notify pgrst, 'reload schema';
