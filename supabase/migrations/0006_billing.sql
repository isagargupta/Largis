-- Largis Venture — billing: contracts, GST invoices with line items, and private PDF storage.
-- Applies on top of 0001–0005. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.contract_status as enum ('draft', 'active', 'expired', 'terminated');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.billing_cycle as enum ('monthly', 'quarterly', 'annual', 'one_time');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.invoice_status as enum ('draft', 'issued', 'paid', 'overdue', 'void');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Billing records outlive nothing: a client with contracts or invoices cannot be deleted (restrict).
create table if not exists public.contracts (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete restrict,
  title                text not null check (char_length(title) between 2 and 200),
  service_line         text not null default 'other' check (service_line in ('backend', 'support', 'software', 'other')),
  status               public.contract_status not null default 'draft',
  start_date           date,
  end_date             date,
  billing_cycle        public.billing_cycle not null default 'monthly',
  currency             text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  monthly_value_cents  bigint not null default 0 check (monthly_value_cents between 0 and 100000000000000),
  notes                text check (char_length(notes) <= 5000),
  document_path        text check (char_length(document_path) <= 300),
  created_by           uuid references auth.users (id) on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint contracts_dates_check check (start_date is null or end_date is null or end_date >= start_date)
);

create index if not exists contracts_org_idx on public.contracts (organization_id, status);

-- One gapless counter per Indian financial year (April–March), as GST invoice serials must be consecutive.
create table if not exists public.invoice_number_counters (
  fiscal_year  integer primary key check (fiscal_year between 2000 and 2999),
  last_number  integer not null default 0 check (last_number >= 0)
);

create table if not exists public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  contract_id        uuid references public.contracts (id) on delete restrict,
  number             text unique check (char_length(number) <= 16),
  issue_date         date,
  due_date           date,
  currency           text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  subtotal_cents     bigint not null default 0,
  tax_rate_bps       integer not null default 1800 check (tax_rate_bps between 0 and 10000),
  tax_cents          bigint not null default 0,
  total_cents        bigint not null default 0,
  status             public.invoice_status not null default 'draft',
  issued_at          timestamptz,
  paid_at            timestamptz,
  payment_reference  text check (char_length(payment_reference) <= 120),
  pdf_path           text check (char_length(pdf_path) <= 300),
  bill_to            text check (char_length(bill_to) <= 1000),
  notes              text check (char_length(notes) <= 2000),
  created_by         uuid references auth.users (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint invoices_number_when_issued check ((status = 'draft') = (number is null)),
  constraint invoices_due_after_issue check (issue_date is null or due_date is null or due_date >= issue_date)
);

create index if not exists invoices_org_idx on public.invoices (organization_id, status, due_date);
create index if not exists invoices_status_due_idx on public.invoices (status, due_date);
create index if not exists invoices_contract_idx on public.invoices (contract_id);

create table if not exists public.invoice_items (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null references public.invoices (id) on delete cascade,
  organization_id   uuid not null references public.organizations (id) on delete restrict,
  description       text not null check (char_length(description) between 1 and 500),
  quantity          numeric(12, 2) not null default 1 check (quantity > 0 and quantity <= 1000000),
  unit_price_cents  bigint not null check (unit_price_cents between 0 and 10000000000000),
  amount_cents      bigint not null default 0,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id, sort_order);
create index if not exists invoice_items_org_idx on public.invoice_items (organization_id);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Billing dates follow India Standard Time, where Largis issues invoices.
create or replace function public.billing_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

create or replace function public.can_view_billing(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff() or coalesce(public.org_role_for(org) in ('owner', 'admin', 'manager'), false)
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.contracts_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'A contract cannot move to another client' using errcode = 'P0001';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists contracts_before_write on public.contracts;
create trigger contracts_before_write
before insert or update on public.contracts
for each row execute function public.contracts_before_write();

-- Assigns the next number in the current financial year, e.g. LVI-2026-0001 for FY 2026–27.
create or replace function public.next_invoice_number(p_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  fy integer := case when extract(month from p_date) >= 4 then extract(year from p_date)::int else extract(year from p_date)::int - 1 end;
  n integer;
begin
  insert into public.invoice_number_counters (fiscal_year, last_number)
  values (fy, 1)
  on conflict (fiscal_year) do update set last_number = public.invoice_number_counters.last_number + 1
  returning last_number into n;
  return 'LVI-' || fy::text || '-' || case when n < 10000 then lpad(n::text, 4, '0') else n::text end;
end;
$$;

-- Drafts are freely editable. Once issued, only the status and payment fields change, and only along
-- issued -> paid | overdue | void and overdue -> paid | void. Totals always come from the line items.
create or replace function public.invoices_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  items_total bigint;
  item_count integer;
begin
  if new.contract_id is not null
     and (tg_op = 'INSERT' or new.contract_id is distinct from old.contract_id)
     and not exists (select 1 from public.contracts where id = new.contract_id and organization_id = new.organization_id)
  then
    raise exception 'The contract belongs to a different client' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New invoices start as drafts' using errcode = 'P0001';
    end if;
    new.number := null;
    new.issue_date := null;
    new.issued_at := null;
    new.paid_at := null;
    new.payment_reference := null;
    new.pdf_path := null;
    new.subtotal_cents := 0;
    new.tax_cents := 0;
    new.total_cents := 0;
    new.created_by := coalesce(auth.uid(), new.created_by);
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'An invoice cannot move to another client' using errcode = 'P0001';
  end if;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if old.status = 'draft' then
    if new.status not in ('draft', 'issued') then
      raise exception 'Issue the invoice before recording a payment or voiding it' using errcode = 'P0001';
    end if;

    select coalesce(sum(amount_cents), 0), count(*) into items_total, item_count
    from public.invoice_items where invoice_id = new.id;
    new.subtotal_cents := items_total;
    new.tax_cents := round(items_total * new.tax_rate_bps / 10000.0)::bigint;
    new.total_cents := new.subtotal_cents + new.tax_cents;
    new.paid_at := null;
    new.payment_reference := null;

    if new.status = 'issued' then
      if item_count = 0 or new.total_cents <= 0 then
        raise exception 'Add at least one line item with an amount before issuing' using errcode = 'P0001';
      end if;
      new.issue_date := public.billing_today();
      new.due_date := coalesce(new.due_date, new.issue_date + 15);
      if new.due_date < new.issue_date then
        raise exception 'The due date cannot be before today, the issue date' using errcode = 'P0001';
      end if;
      new.number := public.next_invoice_number(new.issue_date);
      new.issued_at := now();
    else
      new.number := null;
      new.issue_date := null;
      new.issued_at := null;
      new.pdf_path := null;
    end if;
  else
    if (new.contract_id, new.number, new.issue_date, new.due_date, new.currency, new.subtotal_cents,
        new.tax_rate_bps, new.tax_cents, new.total_cents, new.bill_to, new.notes, new.issued_at)
       is distinct from
       (old.contract_id, old.number, old.issue_date, old.due_date, old.currency, old.subtotal_cents,
        old.tax_rate_bps, old.tax_cents, old.total_cents, old.bill_to, old.notes, old.issued_at)
    then
      raise exception 'Issued invoices are locked. Void it and issue a new one to make changes' using errcode = 'P0001';
    end if;

    if new.status is distinct from old.status and not (
         (old.status = 'issued' and new.status in ('paid', 'overdue', 'void'))
         or (old.status = 'overdue' and new.status in ('paid', 'void'))
       )
    then
      raise exception 'An invoice cannot go from % to %', old.status, new.status using errcode = 'P0001';
    end if;

    if new.status = 'paid' then
      new.paid_at := coalesce(new.paid_at, old.paid_at, now());
    else
      new.paid_at := null;
      if new.status <> 'void' then
        new.payment_reference := null;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists invoices_before_write on public.invoices;
create trigger invoices_before_write
before insert or update on public.invoices
for each row execute function public.invoices_before_write();

create or replace function public.invoices_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'draft' then
    raise exception 'Issued invoices cannot be deleted. Void the invoice instead' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists invoices_before_delete on public.invoices;
create trigger invoices_before_delete
before delete on public.invoices
for each row execute function public.invoices_before_delete();

-- Line items inherit the invoice's organization, compute their amount, and only change while it is a draft.
create or replace function public.invoice_items_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  select organization_id, status into inv
  from public.invoices
  where id = case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;

  if tg_op = 'DELETE' then
    -- The parent row is already gone when a draft invoice is deleted.
    if found and inv.status <> 'draft' then
      raise exception 'Issued invoices are locked. Void it and issue a new one to make changes' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if not found then
    raise exception 'That invoice does not exist' using errcode = '23503';
  end if;
  if inv.status <> 'draft' then
    raise exception 'Issued invoices are locked. Void it and issue a new one to make changes' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.invoice_id is distinct from old.invoice_id then
    raise exception 'A line item cannot move to another invoice' using errcode = 'P0001';
  end if;

  new.organization_id := inv.organization_id;
  new.amount_cents := round(new.quantity * new.unit_price_cents)::bigint;
  return new;
end;
$$;

drop trigger if exists invoice_items_before_write on public.invoice_items;
create trigger invoice_items_before_write
before insert or update or delete on public.invoice_items
for each row execute function public.invoice_items_before_write();

-- Touching each affected draft once per statement makes invoices_before_write recompute its totals.
create or replace function public.invoice_items_touch_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invoices
  set updated_at = now()
  where status = 'draft' and id in (select distinct invoice_id from changed_items);
  return null;
end;
$$;

-- Same, for deleted rows (transition tables cannot be shared between events).
create or replace function public.invoice_items_touch_old()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invoices
  set updated_at = now()
  where status = 'draft' and id in (select distinct invoice_id from removed_items);
  return null;
end;
$$;

drop trigger if exists invoice_items_after_insert on public.invoice_items;
create trigger invoice_items_after_insert
after insert on public.invoice_items
referencing new table as changed_items
for each statement execute function public.invoice_items_touch_new();

drop trigger if exists invoice_items_after_update on public.invoice_items;
create trigger invoice_items_after_update
after update on public.invoice_items
referencing new table as changed_items
for each statement execute function public.invoice_items_touch_new();

drop trigger if exists invoice_items_after_delete on public.invoice_items;
create trigger invoice_items_after_delete
after delete on public.invoice_items
referencing old table as removed_items
for each statement execute function public.invoice_items_touch_old();

-- Replaces a draft's line items in one transaction. Runs with the caller's rights, so RLS applies.
create or replace function public.replace_invoice_items(p_invoice uuid, p_items jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  inserted integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Line items must be a list of at most 100 entries' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.invoices where id = p_invoice and status = 'draft') then
    raise exception 'Only draft invoices can be edited' using errcode = 'P0001';
  end if;

  delete from public.invoice_items where invoice_id = p_invoice;
  insert into public.invoice_items (invoice_id, description, quantity, unit_price_cents, sort_order)
  select
    p_invoice,
    e.item ->> 'description',
    (e.item ->> 'quantity')::numeric,
    (e.item ->> 'unit_price_cents')::bigint,
    (e.ord - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as e(item, ord);
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- Issued invoices past their due date become overdue. Returns how many changed.
create or replace function public.mark_overdue_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Only Largis staff can update invoice statuses' using errcode = '42501';
  end if;
  update public.invoices
  set status = 'overdue'
  where status = 'issued' and due_date < public.billing_today();
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: owners, admins, and managers read their billing; only staff write
-- ---------------------------------------------------------------------------

alter table public.contracts               enable row level security;
alter table public.invoices                enable row level security;
alter table public.invoice_items           enable row level security;
alter table public.invoice_number_counters enable row level security;

drop policy if exists "contracts_select" on public.contracts;
create policy "contracts_select" on public.contracts
  for select to authenticated
  using (public.is_staff() or (status <> 'draft' and public.can_view_billing(organization_id)));

drop policy if exists "contracts_staff_all" on public.contracts;
create policy "contracts_staff_all" on public.contracts
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Clients never see drafts.
drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select" on public.invoices
  for select to authenticated
  using (public.is_staff() or (status <> 'draft' and public.can_view_billing(organization_id)));

drop policy if exists "invoices_staff_all" on public.invoices;
create policy "invoices_staff_all" on public.invoices
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "invoice_items_select" on public.invoice_items;
create policy "invoice_items_select" on public.invoice_items
  for select to authenticated
  using (
    public.is_staff()
    or (
      public.can_view_billing(organization_id)
      and exists (select 1 from public.invoices i where i.id = invoice_id and i.status <> 'draft')
    )
  );

drop policy if exists "invoice_items_staff_all" on public.invoice_items;
create policy "invoice_items_staff_all" on public.invoice_items
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- invoice_number_counters has no policies: only the security-definer numbering function touches it.

-- ---------------------------------------------------------------------------
-- Storage: private "billing" bucket
-- Paths: {organization_id}/invoices/{invoice_id}.pdf and {organization_id}/contracts/{contract_id}.pdf
-- ---------------------------------------------------------------------------

-- Whether the caller may read a billing object: staff always; client owners, admins, and managers only
-- for their organization's non-draft invoices and contracts at the conventional path.
create or replace function public.can_read_billing_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  org uuid;
  record_id uuid;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if auth.uid() is null then
    return false;
  end if;
  if public.is_staff() then
    return true;
  end if;

  parts := string_to_array(coalesce(p_name, ''), '/');
  if coalesce(array_length(parts, 1), 0) <> 3
     or parts[1] !~ uuid_re
     or parts[2] not in ('invoices', 'contracts')
     or parts[3] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  then
    return false;
  end if;
  org := parts[1]::uuid;
  record_id := left(parts[3], 36)::uuid;

  if not coalesce(public.org_role_for(org) in ('owner', 'admin', 'manager'), false) then
    return false;
  end if;

  if parts[2] = 'invoices' then
    return exists (select 1 from public.invoices where id = record_id and organization_id = org and status <> 'draft');
  end if;
  return exists (select 1 from public.contracts where id = record_id and organization_id = org and status <> 'draft');
end;
$$;

do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Storage schema not found; skipping the billing bucket and its policies';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('billing', 'billing', false, 10485760, array['application/pdf'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "billing_staff_all" on storage.objects';
  execute $p$
    create policy "billing_staff_all" on storage.objects
      for all to authenticated
      using (bucket_id = 'billing' and public.is_staff())
      with check (bucket_id = 'billing' and public.is_staff())
  $p$;

  execute 'drop policy if exists "billing_client_read" on storage.objects';
  execute $p$
    create policy "billing_client_read" on storage.objects
      for select to authenticated
      using (bucket_id = 'billing' and public.can_read_billing_object(name))
  $p$;
end $$;

-- ---------------------------------------------------------------------------
-- Grants (this project does not auto-grant; see 0002)
-- ---------------------------------------------------------------------------

grant select, delete on public.contracts to authenticated;
grant insert (
  organization_id, title, service_line, status, start_date, end_date, billing_cycle, currency,
  monthly_value_cents, notes
) on public.contracts to authenticated;
grant update (
  title, service_line, status, start_date, end_date, billing_cycle, currency, monthly_value_cents, notes,
  document_path
) on public.contracts to authenticated;

-- Numbers, dates stamped at issue, and totals are maintained by triggers only.
grant select, delete on public.invoices to authenticated;
grant insert (organization_id, contract_id, due_date, currency, tax_rate_bps, bill_to, notes) on public.invoices to authenticated;
grant update (
  contract_id, due_date, currency, tax_rate_bps, bill_to, notes, status, paid_at, payment_reference, pdf_path
) on public.invoices to authenticated;

grant select, delete on public.invoice_items to authenticated;
grant insert (invoice_id, description, quantity, unit_price_cents, sort_order) on public.invoice_items to authenticated;
grant update (description, quantity, unit_price_cents, sort_order) on public.invoice_items to authenticated;

revoke all on public.invoice_number_counters from anon, authenticated;

revoke all on function public.billing_today()                         from public, anon;
revoke all on function public.can_view_billing(uuid)                  from public, anon;
revoke all on function public.can_read_billing_object(text)           from public, anon;
revoke all on function public.replace_invoice_items(uuid, jsonb)      from public, anon;
revoke all on function public.mark_overdue_invoices()                 from public, anon;
revoke all on function public.next_invoice_number(date)               from public, anon, authenticated;
revoke all on function public.contracts_before_write()                from public, anon, authenticated;
revoke all on function public.invoices_before_write()                 from public, anon, authenticated;
revoke all on function public.invoices_before_delete()                from public, anon, authenticated;
revoke all on function public.invoice_items_before_write()            from public, anon, authenticated;
revoke all on function public.invoice_items_touch_new()               from public, anon, authenticated;
revoke all on function public.invoice_items_touch_old()               from public, anon, authenticated;

grant execute on function public.billing_today()                    to authenticated;
grant execute on function public.can_view_billing(uuid)             to authenticated;
grant execute on function public.can_read_billing_object(text)      to authenticated;
grant execute on function public.replace_invoice_items(uuid, jsonb) to authenticated;
grant execute on function public.mark_overdue_invoices()            to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';
