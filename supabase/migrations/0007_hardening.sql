-- Largis Venture — hardening: append-only audit log, MFA policy, database-level masking of deal values,
-- realtime for the support desk, and sign-in rate limits.
-- Applies on top of 0001–0006. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

-- No foreign keys: events must survive the people and records they describe.
create table if not exists public.audit_events (
  id               bigint generated always as identity primary key,
  occurred_at      timestamptz not null default now(),
  actor_id         uuid,
  organization_id  uuid,
  table_name       text not null,
  record_id        text,
  action           text not null check (action in ('insert', 'update', 'delete')),
  changed_columns  text[] not null default '{}',
  old              jsonb,
  new              jsonb
);

create index if not exists audit_events_occurred_idx on public.audit_events (occurred_at desc);
create index if not exists audit_events_org_idx on public.audit_events (organization_id, occurred_at desc);
create index if not exists audit_events_table_idx on public.audit_events (table_name, occurred_at desc);
create index if not exists audit_events_actor_idx on public.audit_events (actor_id, occurred_at desc);

-- Trigger arguments name columns whose values are replaced with "[redacted]" (the change is still recorded).
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  row_data jsonb;
  changed text[] := '{}';
  col text;
  i integer;
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into changed
    from jsonb_each(new_row) n
    where n.key <> 'updated_at' and n.value is distinct from (old_row -> n.key);
    if cardinality(changed) = 0 then
      return null;
    end if;
  end if;

  for i in 0 .. tg_nargs - 1 loop
    col := tg_argv[i];
    if old_row ? col and old_row -> col <> 'null'::jsonb then
      old_row := jsonb_set(old_row, array[col], '"[redacted]"'::jsonb);
    end if;
    if new_row ? col and new_row -> col <> 'null'::jsonb then
      new_row := jsonb_set(new_row, array[col], '"[redacted]"'::jsonb);
    end if;
  end loop;

  row_data := coalesce(new_row, old_row);
  insert into public.audit_events (actor_id, organization_id, table_name, record_id, action, changed_columns, old, new)
  values (
    auth.uid(),
    case when tg_table_name = 'organizations' then (row_data ->> 'id')::uuid else (row_data ->> 'organization_id')::uuid end,
    tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'user_id'),
    lower(tg_op),
    changed,
    old_row,
    new_row
  );
  return null;
end;
$$;

create or replace function public.audit_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit log is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists audit_events_no_change on public.audit_events;
create trigger audit_events_no_change
before update or delete on public.audit_events
for each row execute function public.audit_events_append_only();

drop trigger if exists audit_events_no_truncate on public.audit_events;
create trigger audit_events_no_truncate
before truncate on public.audit_events
for each statement execute function public.audit_events_append_only();

do $$
declare
  audited constant text[][] := array[
    array['organizations', ''],
    array['memberships', ''],
    array['invitations', ''],
    array['staff_members', ''],
    array['leads', 'contact_email,notes'],
    array['support_tickets', 'description,requester_email'],
    array['engagements', ''],
    array['reports', 'body'],
    array['contracts', 'notes'],
    array['invoices', 'notes']
  ];
  t text;
  args text;
  i integer;
begin
  for i in 1 .. array_length(audited, 1) loop
    t := audited[i][1];
    args := (
      select coalesce(string_agg(quote_literal(c), ', '), '')
      from unnest(string_to_array(nullif(audited[i][2], ''), ',')) c
    );
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row_change(%2$s)',
      t, args
    );
  end loop;
end $$;

alter table public.audit_events enable row level security;

-- Only staff admins read the raw log; nobody writes to it except the trigger above.
drop policy if exists "audit_events_admin_select" on public.audit_events;
create policy "audit_events_admin_select" on public.audit_events
  for select to authenticated
  using (public.staff_role_for_me() = 'admin');

-- ---------------------------------------------------------------------------
-- MFA policy
-- ---------------------------------------------------------------------------

create table if not exists public.security_settings (
  id                 boolean primary key default true check (id),
  require_staff_mfa  boolean not null default false,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null
);

insert into public.security_settings (id) values (true) on conflict (id) do nothing;

create or replace function public.security_settings_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists security_settings_before_update on public.security_settings;
create trigger security_settings_before_update
before update on public.security_settings
for each row execute function public.security_settings_before_update();

drop trigger if exists audit_security_settings on public.security_settings;
create trigger audit_security_settings
after update on public.security_settings
for each row execute function public.audit_row_change();

alter table public.security_settings enable row level security;

drop policy if exists "security_settings_staff_select" on public.security_settings;
create policy "security_settings_staff_select" on public.security_settings
  for select to authenticated
  using (public.is_staff());

drop policy if exists "security_settings_admin_update" on public.security_settings;
create policy "security_settings_admin_update" on public.security_settings
  for update to authenticated
  using (public.staff_role_for_me() = 'admin')
  with check (public.staff_role_for_me() = 'admin');

alter table public.organizations add column if not exists require_mfa boolean not null default false;

-- Extends 0003: the MFA requirement is also a staff-managed field.
create or replace function public.guard_org_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_staff()
     and (new.slug, new.plan, new.region, new.status, new.require_mfa)
         is distinct from (old.slug, old.plan, old.region, old.status, old.require_mfa)
  then
    raise exception 'Only Largis staff can change the plan, region, status, identifier, or MFA requirement'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deal values: hidden from agents in the database, not just the interface
-- ---------------------------------------------------------------------------

-- Signed-in users read every lead column except value_cents. Columns added to leads later need adding here.
revoke select on public.leads from authenticated;
grant select (
  id, organization_id, company, contact_name, contact_email, stage, owner_id, source, notes, created_at, updated_at
) on public.leads to authenticated;

-- Values for one organization's leads, for roles allowed to see them (staff, owner, admin, manager, viewer).
-- Agents get no rows.
create or replace function public.lead_values(p_org uuid)
returns table (id uuid, stage public.lead_stage, value_cents bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.stage, l.value_cents
  from public.leads l
  where l.organization_id = p_org
    and (public.is_staff() or coalesce(public.org_role_for(p_org) in ('owner', 'admin', 'manager', 'viewer'), false))
$$;

-- Agents may create and edit their leads but never set a value they cannot see.
create or replace function public.leads_guard_value()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_staff()
     and public.org_role_for(new.organization_id) is not distinct from 'agent'
  then
    if tg_op = 'INSERT' then
      new.value_cents := 0;
    else
      new.value_cents := old.value_cents;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_guard_value on public.leads;
create trigger leads_guard_value
before insert or update on public.leads
for each row execute function public.leads_guard_value();

-- ---------------------------------------------------------------------------
-- Realtime: support desk changes stream to subscribers, filtered by RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime not found; skipping realtime setup';
    return;
  end if;
  foreach t in array array['support_tickets', 'ticket_messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Sign-in rate limits (server-side only, through the secret key)
-- ---------------------------------------------------------------------------

create table if not exists public.auth_rate_limits (
  bucket        text not null check (char_length(bucket) <= 200),
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists auth_rate_limits_window_idx on public.auth_rate_limits (window_start);

-- Counts one attempt in a fixed window and reports whether it is within the limit.
create or replace function public.auth_rate_limit_hit(p_bucket text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  started timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  total integer;
begin
  insert into public.auth_rate_limits (bucket, window_start, hits)
  values (p_bucket, started, 1)
  on conflict (bucket, window_start) do update set hits = public.auth_rate_limits.hits + 1
  returning hits into total;

  if random() < 0.02 then
    delete from public.auth_rate_limits where window_start < now() - interval '1 day';
  end if;
  return total <= p_max;
end;
$$;

alter table public.auth_rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Grants (this project does not auto-grant; see 0002)
-- ---------------------------------------------------------------------------

grant select on public.audit_events to authenticated;
grant select on public.security_settings to authenticated;
grant update (require_staff_mfa) on public.security_settings to authenticated;
revoke all on public.auth_rate_limits from anon, authenticated;

revoke all on function public.audit_row_change()                         from public, anon, authenticated;
revoke all on function public.audit_events_append_only()                 from public, anon, authenticated;
revoke all on function public.security_settings_before_update()          from public, anon, authenticated;
revoke all on function public.guard_org_change()                         from public, anon, authenticated;
revoke all on function public.leads_guard_value()                        from public, anon, authenticated;
revoke all on function public.lead_values(uuid)                          from public, anon;
revoke all on function public.auth_rate_limit_hit(text, integer, integer) from public, anon, authenticated;

grant execute on function public.lead_values(uuid) to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Append-only, even for the secret key.
revoke insert, update, delete, truncate on public.audit_events from anon, authenticated, service_role;

notify pgrst, 'reload schema';
