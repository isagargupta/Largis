-- RevenueDesk core workflow: pipeline labels, follow-up tasks, approval-gated suggestions,
-- and assignment. Applies after 0015 has committed the `contacted` stage. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Lead fields
-- ---------------------------------------------------------------------------

alter table public.leads alter column company drop not null;

alter table public.leads
  add column if not exists phone text,
  add column if not exists service_address text,
  add column if not exists job_type text,
  add column if not exists lost_reason text,
  add column if not exists first_contacted_at timestamptz,
  add column if not exists phone_digits text;

do $$
begin
  alter table public.leads add constraint leads_company_length
    check (company is null or char_length(company) <= 160);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.leads add constraint leads_phone_length
    check (phone is null or char_length(phone) <= 40);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.leads add constraint leads_service_address_length
    check (service_address is null or char_length(service_address) <= 300);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.leads add constraint leads_job_type_length
    check (job_type is null or char_length(job_type) <= 80);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.leads add constraint leads_lost_reason_length
    check (lost_reason is null or char_length(lost_reason) <= 500);
exception when duplicate_object then null;
end $$;

-- Existing rows all have a company. New homeowner leads may omit it when a person and a phone or email are present.
do $$
begin
  alter table public.leads add constraint leads_has_identity check (
    company is not null
    or (
      char_length(btrim(contact_name)) >= 2
      and (contact_email is not null or phone is not null)
    )
  );
exception when duplicate_object then null;
end $$;

create index if not exists leads_org_email_idx
  on public.leads (organization_id, contact_email)
  where contact_email is not null;

create index if not exists leads_org_phone_idx
  on public.leads (organization_id, phone_digits)
  where phone_digits is not null;

create index if not exists activity_log_entity_idx
  on public.activity_log (organization_id, entity, entity_id, created_at desc);

-- Phone digits and the first-contact timestamp are derived. Clients cannot backdate a response.
create or replace function public.leads_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.phone_digits := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
  if tg_op = 'UPDATE' and old.stage <> 'new' then
    new.first_contacted_at := old.first_contacted_at;
  elsif new.stage = 'new' then
    new.first_contacted_at := case when tg_op = 'UPDATE' then old.first_contacted_at else null end;
  else
    new.first_contacted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists leads_before_write on public.leads;
create trigger leads_before_write
before insert or update on public.leads
for each row execute function public.leads_before_write();

-- Signed-in users read every lead column except value_cents.
revoke select on public.leads from authenticated;
grant select (
  id, organization_id, company, contact_name, contact_email, phone, phone_digits,
  service_address, job_type, lost_reason, first_contacted_at, stage, owner_id, source,
  notes, created_at, updated_at
) on public.leads to authenticated;

-- Redact contact details in the audit log. The change itself is still recorded.
drop trigger if exists audit_leads on public.leads;
create trigger audit_leads
after insert or update or delete on public.leads
for each row execute function public.audit_row_change('contact_email', 'notes', 'phone', 'service_address');

-- ---------------------------------------------------------------------------
-- Pipeline labels and assignment
-- ---------------------------------------------------------------------------

create table if not exists public.organization_pipeline_stages (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  stage            public.lead_stage not null,
  label            text not null check (char_length(btrim(label)) between 1 and 40),
  position         integer not null check (position between 0 and 20),
  hidden           boolean not null default false,
  primary key (organization_id, stage)
);

create table if not exists public.organization_revenue_settings (
  organization_id   uuid primary key references public.organizations (id) on delete cascade,
  assignment_mode   text not null default 'manual' check (assignment_mode in ('manual', 'round_robin', 'fixed')),
  fixed_owner_id    uuid references auth.users (id) on delete set null,
  last_owner_id     uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now()
);

create or replace function public.seed_revenue_for(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_pipeline_stages (organization_id, stage, label, position, hidden)
  values
    (p_org, 'new', 'New', 0, false),
    (p_org, 'contacted', 'Contacted', 1, true),
    (p_org, 'qualified', 'Qualified', 2, false),
    (p_org, 'proposal', 'Proposal', 3, false),
    (p_org, 'negotiation', 'Negotiation', 4, false),
    (p_org, 'won', 'Won', 5, false),
    (p_org, 'lost', 'Lost', 6, false)
  on conflict (organization_id, stage) do nothing;

  insert into public.organization_revenue_settings (organization_id)
  values (p_org)
  on conflict (organization_id) do nothing;
end;
$$;

create or replace function public.organizations_seed_revenue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_revenue_for(new.id);
  return new;
end;
$$;

drop trigger if exists organizations_seed_revenue on public.organizations;
create trigger organizations_seed_revenue
after insert on public.organizations
for each row execute function public.organizations_seed_revenue();

do $$
declare
  org uuid;
begin
  for org in select id from public.organizations loop
    perform public.seed_revenue_for(org);
  end loop;
end $$;

create or replace function public.guard_pipeline_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id or new.stage is distinct from old.stage then
    raise exception 'Stage identity cannot be changed' using errcode = '42501';
  end if;
  new.label := btrim(new.label);
  if char_length(new.label) < 1 or char_length(new.label) > 40 then
    raise exception 'Stage labels must be 1–40 characters' using errcode = 'P0001';
  end if;
  if new.hidden and new.stage in ('new', 'won', 'lost') then
    raise exception 'New, Won, and Lost stay visible' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists pipeline_stage_guard on public.organization_pipeline_stages;
create trigger pipeline_stage_guard
before update on public.organization_pipeline_stages
for each row execute function public.guard_pipeline_stage();

create or replace function public.guard_revenue_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.assignment_mode = 'fixed' then
    if new.fixed_owner_id is null or not exists (
      select 1 from public.memberships
      where organization_id = new.organization_id
        and user_id = new.fixed_owner_id
        and role in ('owner', 'admin', 'manager', 'agent')
    ) then
      raise exception 'Choose a member who can own leads' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists revenue_settings_guard on public.organization_revenue_settings;
create trigger revenue_settings_guard
before update on public.organization_revenue_settings
for each row execute function public.guard_revenue_settings();

-- Next owner when a lead is created without one. Manual mode returns null.
-- Round-robin locks the settings row so two creates cannot take the same turn.
create or replace function public.next_lead_owner(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  mode text;
  fixed uuid;
  previous uuid;
  chosen uuid;
begin
  if auth.uid() is null
     or not (public.is_staff() or public.org_role_for(p_org) in ('owner', 'admin', 'manager'))
  then
    return null;
  end if;

  select assignment_mode, fixed_owner_id, last_owner_id
    into mode, fixed, previous
  from public.organization_revenue_settings
  where organization_id = p_org
  for update;

  if mode is null or mode = 'manual' then
    return null;
  end if;

  if mode = 'fixed' then
    if exists (
      select 1 from public.memberships
      where organization_id = p_org
        and user_id = fixed
        and role in ('owner', 'admin', 'manager', 'agent')
    ) then
      return fixed;
    end if;
    return null;
  end if;

  select user_id into chosen
  from public.memberships
  where organization_id = p_org
    and role in ('owner', 'admin', 'manager', 'agent')
    and (previous is null or user_id > previous)
  order by user_id
  limit 1;

  if chosen is null then
    select user_id into chosen
    from public.memberships
    where organization_id = p_org
      and role in ('owner', 'admin', 'manager', 'agent')
    order by user_id
    limit 1;
  end if;

  if chosen is not null then
    update public.organization_revenue_settings
    set last_owner_id = chosen
    where organization_id = p_org;
  end if;

  return chosen;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks and suggestions
-- ---------------------------------------------------------------------------

create table if not exists public.lead_tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  lead_id          uuid not null references public.leads (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 200),
  owner_id         uuid references auth.users (id) on delete set null,
  due_at           timestamptz,
  status           text not null default 'open' check (status in ('open', 'done')),
  completed_at     timestamptz,
  reminded_at      timestamptz,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists lead_tasks_lead_idx on public.lead_tasks (lead_id, status);
create index if not exists lead_tasks_reminder_idx
  on public.lead_tasks (due_at)
  where status = 'open' and reminded_at is null and due_at is not null;

create table if not exists public.lead_suggestions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  lead_id          uuid not null references public.leads (id) on delete cascade,
  kind             text not null check (kind in ('summary', 'reply', 'next_action')),
  body             text not null check (char_length(body) between 1 and 4000),
  status           text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  task_id          uuid references public.lead_tasks (id) on delete set null,
  decided_by       uuid references auth.users (id) on delete set null,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists lead_suggestions_lead_idx
  on public.lead_suggestions (lead_id, created_at desc);

create table if not exists public.organization_ai_usage (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  month            date not null,
  count            integer not null default 0 check (count >= 0),
  primary key (organization_id, month)
);

create or replace function public.can_read_lead(p_org uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    or public.org_role_for(p_org) in ('owner', 'admin', 'manager', 'viewer')
    or (public.org_role_for(p_org) = 'agent' and p_owner = auth.uid())
$$;

create or replace function public.can_edit_lead(p_org uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    or public.org_role_for(p_org) in ('owner', 'admin', 'manager')
    or (public.org_role_for(p_org) = 'agent' and p_owner = auth.uid())
$$;

create or replace function public.guard_lead_task()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.leads
    where id = new.lead_id and organization_id = new.organization_id
  ) then
    raise exception 'That lead is not in this organisation' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and (new.lead_id is distinct from old.lead_id or new.organization_id is distinct from old.organization_id)
  then
    raise exception 'A task cannot be moved to another lead' using errcode = '42501';
  end if;

  new.title := btrim(new.title);
  if tg_op = 'UPDATE' and new.status = 'open' and new.due_at is distinct from old.due_at then
    new.reminded_at := null;
  end if;
  if new.status = 'done' then
    new.completed_at := case
      when tg_op = 'UPDATE' then coalesce(old.completed_at, now())
      else coalesce(new.completed_at, now())
    end;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists lead_tasks_guard on public.lead_tasks;
create trigger lead_tasks_guard
before insert or update on public.lead_tasks
for each row execute function public.guard_lead_task();

drop trigger if exists lead_tasks_touch_updated_at on public.lead_tasks;
create trigger lead_tasks_touch_updated_at
before update on public.lead_tasks
for each row execute function public.touch_updated_at();

-- Won or Lost closes open follow-ups on that lead.
create or replace function public.leads_close_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage in ('won', 'lost') and old.stage is distinct from new.stage then
    update public.lead_tasks
    set status = 'done'
    where lead_id = new.id
      and organization_id = new.organization_id
      and status = 'open';
  end if;
  return null;
end;
$$;

drop trigger if exists leads_close_tasks on public.leads;
create trigger leads_close_tasks
after update of stage on public.leads
for each row execute function public.leads_close_tasks();

create or replace function public.guard_lead_suggestion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.leads
    where id = new.lead_id and organization_id = new.organization_id
  ) then
    raise exception 'That lead is not in this organisation' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.task_id := null;
    new.decided_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists lead_suggestions_guard on public.lead_suggestions;
create trigger lead_suggestions_guard
before insert or update on public.lead_suggestions
for each row execute function public.guard_lead_suggestion();

drop trigger if exists lead_suggestions_touch_updated_at on public.lead_suggestions;
create trigger lead_suggestions_touch_updated_at
before update on public.lead_suggestions
for each row execute function public.touch_updated_at();

-- 50 suggestions per organisation per UTC month. The cap lives here so a client cannot raise it.
create or replace function public.consume_ai_suggestion(p_org uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cap constant integer := 50;
  month_start date := date_trunc('month', timezone('utc', now()))::date;
  used integer;
begin
  if auth.uid() is null
     or not (
       public.is_staff()
       or public.org_role_for(p_org) in ('owner', 'admin', 'manager', 'agent')
     )
  then
    return false;
  end if;

  insert into public.organization_ai_usage (organization_id, month, count)
  values (p_org, month_start, 1)
  on conflict (organization_id, month) do update
    set count = public.organization_ai_usage.count + 1
    where public.organization_ai_usage.count < cap
  returning count into used;

  return used is not null;
end;
$$;

create or replace function public.release_ai_suggestion(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date := date_trunc('month', timezone('utc', now()))::date;
begin
  if auth.uid() is null
     or not (
       public.is_staff()
       or public.org_role_for(p_org) in ('owner', 'admin', 'manager', 'agent')
     )
  then
    return;
  end if;

  update public.organization_ai_usage
  set count = greatest(count - 1, 0)
  where organization_id = p_org and month = month_start and count > 0;
end;
$$;

-- Approving a next action creates one task. Approving again returns that task and does not create another.
create or replace function public.approve_lead_suggestion(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  suggestion public.lead_suggestions%rowtype;
  lead public.leads%rowtype;
  created uuid;
begin
  select * into suggestion
  from public.lead_suggestions
  where id = p_id
  for update;

  if not found then
    raise exception 'That suggestion no longer exists' using errcode = 'P0001';
  end if;

  select * into lead
  from public.leads
  where id = suggestion.lead_id and organization_id = suggestion.organization_id;

  if not found or not public.can_edit_lead(lead.organization_id, lead.owner_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;

  if suggestion.status = 'approved' then
    return suggestion.task_id;
  end if;
  if suggestion.status <> 'pending' then
    raise exception 'That suggestion has already been dismissed.' using errcode = 'P0001';
  end if;

  if suggestion.kind = 'next_action' then
    insert into public.lead_tasks (organization_id, lead_id, title, owner_id, due_at, created_by)
    values (
      suggestion.organization_id,
      suggestion.lead_id,
      left(btrim(suggestion.body), 200),
      coalesce(lead.owner_id, auth.uid()),
      now() + interval '1 day',
      auth.uid()
    )
    returning id into created;
  end if;

  update public.lead_suggestions
  set status = 'approved',
      decided_by = auth.uid(),
      task_id = created
  where id = suggestion.id;

  return created;
end;
$$;

create or replace function public.dismiss_lead_suggestion(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  suggestion public.lead_suggestions%rowtype;
  lead public.leads%rowtype;
begin
  select * into suggestion
  from public.lead_suggestions
  where id = p_id
  for update;

  if not found then
    return false;
  end if;

  select * into lead
  from public.leads
  where id = suggestion.lead_id and organization_id = suggestion.organization_id;

  if not found or not public.can_edit_lead(lead.organization_id, lead.owner_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;

  if suggestion.status <> 'pending' then
    return false;
  end if;

  update public.lead_suggestions
  set status = 'dismissed', decided_by = auth.uid()
  where id = suggestion.id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organization_pipeline_stages enable row level security;
alter table public.organization_revenue_settings enable row level security;
alter table public.lead_tasks enable row level security;
alter table public.lead_suggestions enable row level security;
alter table public.organization_ai_usage enable row level security;

drop policy if exists "pipeline_select" on public.organization_pipeline_stages;
create policy "pipeline_select" on public.organization_pipeline_stages
  for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

drop policy if exists "pipeline_update" on public.organization_pipeline_stages;
create policy "pipeline_update" on public.organization_pipeline_stages
  for update to authenticated
  using (public.is_staff() or public.org_role_for(organization_id) in ('owner', 'admin'))
  with check (public.is_staff() or public.org_role_for(organization_id) in ('owner', 'admin'));

drop policy if exists "revenue_settings_select" on public.organization_revenue_settings;
create policy "revenue_settings_select" on public.organization_revenue_settings
  for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

drop policy if exists "revenue_settings_update" on public.organization_revenue_settings;
create policy "revenue_settings_update" on public.organization_revenue_settings
  for update to authenticated
  using (public.is_staff() or public.org_role_for(organization_id) in ('owner', 'admin'))
  with check (public.is_staff() or public.org_role_for(organization_id) in ('owner', 'admin'));

drop policy if exists "lead_tasks_select" on public.lead_tasks;
create policy "lead_tasks_select" on public.lead_tasks
  for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id
        and l.organization_id = lead_tasks.organization_id
        and public.can_read_lead(l.organization_id, l.owner_id)
    )
  );

drop policy if exists "lead_tasks_insert" on public.lead_tasks;
create policy "lead_tasks_insert" on public.lead_tasks
  for insert to authenticated
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_id
        and l.organization_id = lead_tasks.organization_id
        and public.can_edit_lead(l.organization_id, l.owner_id)
    )
  );

drop policy if exists "lead_tasks_update" on public.lead_tasks;
create policy "lead_tasks_update" on public.lead_tasks
  for update to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id
        and l.organization_id = lead_tasks.organization_id
        and public.can_edit_lead(l.organization_id, l.owner_id)
    )
  )
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_id
        and l.organization_id = lead_tasks.organization_id
        and public.can_edit_lead(l.organization_id, l.owner_id)
    )
  );

drop policy if exists "lead_tasks_delete" on public.lead_tasks;
create policy "lead_tasks_delete" on public.lead_tasks
  for delete to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id
        and l.organization_id = lead_tasks.organization_id
        and public.can_edit_lead(l.organization_id, l.owner_id)
    )
  );

drop policy if exists "lead_suggestions_select" on public.lead_suggestions;
create policy "lead_suggestions_select" on public.lead_suggestions
  for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id
        and l.organization_id = lead_suggestions.organization_id
        and public.can_read_lead(l.organization_id, l.owner_id)
    )
  );

drop policy if exists "lead_suggestions_insert" on public.lead_suggestions;
create policy "lead_suggestions_insert" on public.lead_suggestions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_id
        and l.organization_id = lead_suggestions.organization_id
        and public.can_edit_lead(l.organization_id, l.owner_id)
    )
  );

drop policy if exists "ai_usage_select" on public.organization_ai_usage;
create policy "ai_usage_select" on public.organization_ai_usage
  for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select (organization_id, stage, label, position, hidden) on public.organization_pipeline_stages to authenticated;
grant update (label, position, hidden) on public.organization_pipeline_stages to authenticated;

grant select (organization_id, assignment_mode, fixed_owner_id) on public.organization_revenue_settings to authenticated;
grant update (assignment_mode, fixed_owner_id) on public.organization_revenue_settings to authenticated;

grant select, insert, update, delete on public.lead_tasks to authenticated;
grant select, insert on public.lead_suggestions to authenticated;
grant select (organization_id, month, count) on public.organization_ai_usage to authenticated;

revoke all on function public.leads_before_write() from public, anon, authenticated;
revoke all on function public.seed_revenue_for(uuid) from public, anon, authenticated;
revoke all on function public.organizations_seed_revenue() from public, anon, authenticated;
revoke all on function public.guard_pipeline_stage() from public, anon, authenticated;
revoke all on function public.guard_revenue_settings() from public, anon, authenticated;
revoke all on function public.guard_lead_task() from public, anon, authenticated;
revoke all on function public.leads_close_tasks() from public, anon, authenticated;
revoke all on function public.guard_lead_suggestion() from public, anon, authenticated;
revoke all on function public.can_read_lead(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_edit_lead(uuid, uuid) from public, anon, authenticated;

revoke all on function public.next_lead_owner(uuid) from public, anon;
revoke all on function public.consume_ai_suggestion(uuid) from public, anon;
revoke all on function public.release_ai_suggestion(uuid) from public, anon;
revoke all on function public.approve_lead_suggestion(uuid) from public, anon;
revoke all on function public.dismiss_lead_suggestion(uuid) from public, anon;

grant execute on function public.next_lead_owner(uuid) to authenticated;
grant execute on function public.consume_ai_suggestion(uuid) to authenticated;
grant execute on function public.release_ai_suggestion(uuid) to authenticated;
grant execute on function public.approve_lead_suggestion(uuid) to authenticated;
grant execute on function public.dismiss_lead_suggestion(uuid) to authenticated;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';
