-- Employee joining forms. Admins and managers send a private link; the new hire submits
-- identity, bank, and education details. Documents stay in a private bucket.
-- Class 10 and Class 12 marksheets are mandatory. A college document is stored only when the
-- person has a college qualification, and then it is mandatory.

create or replace function public.can_manage_onboarding()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.staff_role_for_me() in ('admin', 'manager'), false)
$$;

revoke all on function public.can_manage_onboarding() from public, anon;
grant execute on function public.can_manage_onboarding() to authenticated;

create table if not exists public.employee_onboardings (
  id                      uuid primary key default gen_random_uuid(),
  token                   text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$'),
  status                  text not null default 'open' check (status in ('open', 'submitted', 'reviewed', 'revoked')),
  invite_name             text check (invite_name is null or char_length(invite_name) between 2 and 120),
  invite_email            text check (invite_email is null or char_length(invite_email) between 3 and 254),
  invite_phone            text check (invite_phone is null or invite_phone ~ '^[6-9][0-9]{9}$'),
  full_name               text check (full_name is null or char_length(full_name) between 2 and 120),
  father_name             text check (father_name is null or char_length(father_name) between 2 and 120),
  mother_name             text check (mother_name is null or char_length(mother_name) between 2 and 120),
  date_of_birth           date check (date_of_birth is null or (date_of_birth >= '1940-01-01' and date_of_birth <= current_date + 1)),
  gender                  text check (gender is null or gender in ('female', 'male', 'other')),
  marital_status          text check (marital_status is null or marital_status in ('single', 'married', 'divorced', 'widowed')),
  blood_group             text check (blood_group is null or blood_group in ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'unknown')),
  nationality             text check (nationality is null or char_length(nationality) between 2 and 60),
  email                   text check (email is null or char_length(email) between 3 and 254),
  phone                   text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  alternate_phone         text check (alternate_phone is null or alternate_phone ~ '^[6-9][0-9]{9}$'),
  address_line1           text check (address_line1 is null or char_length(address_line1) between 3 and 200),
  address_line2           text check (address_line2 is null or char_length(address_line2) between 1 and 200),
  city                    text check (city is null or char_length(city) between 2 and 80),
  state                   text check (state is null or char_length(state) between 2 and 80),
  pin_code                text check (pin_code is null or pin_code ~ '^[1-9][0-9]{5}$'),
  permanent_same          boolean,
  permanent_line1         text check (permanent_line1 is null or char_length(permanent_line1) between 3 and 200),
  permanent_line2         text check (permanent_line2 is null or char_length(permanent_line2) between 1 and 200),
  permanent_city          text check (permanent_city is null or char_length(permanent_city) between 2 and 80),
  permanent_state         text check (permanent_state is null or char_length(permanent_state) between 2 and 80),
  permanent_pin           text check (permanent_pin is null or permanent_pin ~ '^[1-9][0-9]{5}$'),
  emergency_name          text check (emergency_name is null or char_length(emergency_name) between 2 and 120),
  emergency_relation      text check (emergency_relation is null or emergency_relation in ('parent', 'spouse', 'sibling', 'child', 'friend', 'other')),
  emergency_phone         text check (emergency_phone is null or emergency_phone ~ '^[6-9][0-9]{9}$'),
  aadhaar                 text check (aadhaar is null or aadhaar ~ '^[2-9][0-9]{11}$'),
  pan                     text check (pan is null or pan ~ '^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$'),
  account_holder          text check (account_holder is null or char_length(account_holder) between 2 and 120),
  account_number          text check (account_number is null or account_number ~ '^[0-9]{9,18}$'),
  ifsc                    text check (ifsc is null or ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name               text check (bank_name is null or char_length(bank_name) between 2 and 120),
  branch_name             text check (branch_name is null or char_length(branch_name) between 2 and 120),
  account_type            text check (account_type is null or account_type in ('savings', 'current')),
  tenth_board             text check (tenth_board is null or char_length(tenth_board) between 2 and 80),
  tenth_school            text check (tenth_school is null or char_length(tenth_school) between 2 and 160),
  tenth_year              smallint check (tenth_year is null or tenth_year between 1970 and 2100),
  tenth_score             text check (tenth_score is null or char_length(tenth_score) between 1 and 20),
  twelfth_board           text check (twelfth_board is null or char_length(twelfth_board) between 2 and 80),
  twelfth_school          text check (twelfth_school is null or char_length(twelfth_school) between 2 and 160),
  twelfth_year            smallint check (twelfth_year is null or twelfth_year between 1970 and 2100),
  twelfth_score           text check (twelfth_score is null or char_length(twelfth_score) between 1 and 20),
  has_college             boolean,
  college_degree          text check (college_degree is null or char_length(college_degree) between 2 and 120),
  college_name            text check (college_name is null or char_length(college_name) between 2 and 160),
  college_year            smallint check (college_year is null or college_year between 1970 and 2100),
  college_score           text check (college_score is null or char_length(college_score) between 1 and 20),
  designation             text check (designation is null or char_length(designation) between 2 and 120),
  department              text check (department is null or char_length(department) between 1 and 80),
  employment_type         text check (employment_type is null or employment_type in ('full_time', 'part_time', 'intern', 'contract')),
  joining_date            date,
  work_mode               text check (work_mode is null or work_mode in ('office', 'remote', 'hybrid')),
  experience_years        numeric(4, 1) check (experience_years is null or (experience_years >= 0 and experience_years <= 60)),
  previous_employer       text check (previous_employer is null or char_length(previous_employer) between 1 and 120),
  previous_designation    text check (previous_designation is null or char_length(previous_designation) between 1 and 120),
  uan                     text check (uan is null or uan ~ '^[0-9]{12}$'),
  esi_number              text check (esi_number is null or esi_number ~ '^[0-9]{10,17}$'),
  languages               text check (languages is null or char_length(languages) between 1 and 160),
  shift_preference        text check (shift_preference is null or shift_preference in ('morning', 'afternoon', 'night', 'flexible', 'unsure')),
  documents               jsonb not null default '{}'::jsonb check (pg_column_size(documents) < 8000),
  declaration_accepted    boolean not null default false,
  submitted_at            timestamptz,
  reviewed_at             timestamptz,
  reviewed_by             uuid references auth.users (id) on delete set null,
  staff_notes             text check (staff_notes is null or char_length(staff_notes) <= 2000),
  offered_monthly_inr     integer check (offered_monthly_inr is null or offered_monthly_inr between 1000 and 100000000),
  expires_at              timestamptz not null default (now() + interval '30 days'),
  created_by              uuid references auth.users (id) on delete set null default auth.uid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists employee_onboardings_status_idx on public.employee_onboardings (status, created_at desc);

drop trigger if exists employee_onboardings_touch_updated_at on public.employee_onboardings;
create trigger employee_onboardings_touch_updated_at
  before update on public.employee_onboardings
  for each row execute function public.touch_updated_at();

-- A stored file must point at this record's folder. College is present only when they have one.
create or replace function public.onboarding_file_ok(doc jsonb, id uuid, slot text)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(doc) = 'object'
    and coalesce(doc->>'path', '') ~ (
      '^' || id::text || '/' || slot || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp|heic|heif)$'
    )
    and char_length(coalesce(doc->>'name', '')) between 1 and 200
    and coalesce(doc->>'type', '') in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
    and coalesce(doc->>'size', '') ~ '^[0-9]+$'
    and (doc->>'size')::integer between 1 and 8388608
$$;

revoke all on function public.onboarding_file_ok(jsonb, uuid, text) from public, anon;
grant execute on function public.onboarding_file_ok(jsonb, uuid, text) to authenticated, service_role;

create or replace function public.employee_onboardings_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('submitted', 'reviewed') then
    if new.full_name is null
      or new.father_name is null
      or new.mother_name is null
      or new.date_of_birth is null
      or new.gender is null
      or new.marital_status is null
      or new.nationality is null
      or new.email is null
      or new.phone is null
      or new.address_line1 is null
      or new.city is null
      or new.state is null
      or new.pin_code is null
      or new.permanent_same is null
      or new.emergency_name is null
      or new.emergency_relation is null
      or new.emergency_phone is null
      or new.aadhaar is null
      or new.pan is null
      or new.account_holder is null
      or new.account_number is null
      or new.ifsc is null
      or new.bank_name is null
      or new.branch_name is null
      or new.account_type is null
      or new.tenth_board is null
      or new.tenth_school is null
      or new.tenth_year is null
      or new.tenth_score is null
      or new.twelfth_board is null
      or new.twelfth_school is null
      or new.twelfth_year is null
      or new.twelfth_score is null
      or new.has_college is null
      or new.designation is null
      or new.employment_type is null
      or new.work_mode is null
      or new.declaration_accepted is not true
      or not public.onboarding_file_ok(new.documents->'photo', new.id, 'photo')
      or not public.onboarding_file_ok(new.documents->'aadhaar', new.id, 'aadhaar')
      or not public.onboarding_file_ok(new.documents->'pan', new.id, 'pan')
      or not public.onboarding_file_ok(new.documents->'bank_proof', new.id, 'bank_proof')
      or not public.onboarding_file_ok(new.documents->'tenth', new.id, 'tenth')
      or not public.onboarding_file_ok(new.documents->'twelfth', new.id, 'twelfth')
      or (new.permanent_same is false and (new.permanent_line1 is null or new.permanent_city is null or new.permanent_state is null or new.permanent_pin is null))
      or (new.has_college is true and (
        new.college_degree is null or new.college_name is null or new.college_year is null or new.college_score is null
        or not public.onboarding_file_ok(new.documents->'college', new.id, 'college')
      ))
      or (new.has_college is false and new.documents->'college' is not null)
    then
      raise exception 'This joining form is incomplete.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.employee_onboardings_guard() from public, anon;
grant execute on function public.employee_onboardings_guard() to authenticated, service_role;

drop trigger if exists employee_onboardings_guard on public.employee_onboardings;
create trigger employee_onboardings_guard
  before insert or update on public.employee_onboardings
  for each row execute function public.employee_onboardings_guard();

alter table public.employee_onboardings enable row level security;

drop policy if exists employee_onboardings_staff on public.employee_onboardings;
create policy employee_onboardings_staff on public.employee_onboardings
  for all to authenticated
  using ((select public.can_manage_onboarding()))
  with check ((select public.can_manage_onboarding()));

-- Merges one document at a time so two uploads can't overwrite each other.
create or replace function public.onboarding_set_document(p_id uuid, p_slot text, p_file jsonb, p_require_open boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated uuid;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role'
     and current_user is distinct from 'service_role'
     and not public.can_manage_onboarding() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_slot not in ('photo', 'aadhaar', 'pan', 'bank_proof', 'tenth', 'twelfth', 'college') then
    raise exception 'Unknown document' using errcode = '22023';
  end if;
  if p_file is not null and not public.onboarding_file_ok(p_file, p_id, p_slot) then
    raise exception 'Invalid document' using errcode = '22023';
  end if;

  if p_file is null then
    update public.employee_onboardings
      set documents = documents - p_slot
      where id = p_id
        and (not p_require_open or (status = 'open' and expires_at > now()))
        and (p_require_open or status <> 'revoked')
      returning id into updated;
  else
    update public.employee_onboardings
      set documents = documents || jsonb_build_object(p_slot, p_file)
      where id = p_id
        and (not p_require_open or (status = 'open' and expires_at > now()))
        and (p_require_open or status <> 'revoked')
      returning id into updated;
  end if;
  return updated is not null;
end;
$$;

revoke all on function public.onboarding_set_document(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.onboarding_set_document(uuid, text, jsonb, boolean) to authenticated, service_role;

grant select, insert, update, delete on public.employee_onboardings to authenticated;
grant all on public.employee_onboardings to service_role;

do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Storage schema not found; skipping the onboarding bucket and its policies';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'onboarding',
    'onboarding',
    false,
    8388608,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists onboarding_staff_read on storage.objects';
  execute $p$
    create policy onboarding_staff_read on storage.objects
      for select to authenticated
      using (bucket_id = 'onboarding' and (select public.can_manage_onboarding()))
  $p$;

  execute 'drop policy if exists onboarding_staff_insert on storage.objects';
  execute $p$
    create policy onboarding_staff_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'onboarding' and (select public.can_manage_onboarding()))
  $p$;

  execute 'drop policy if exists onboarding_staff_delete on storage.objects';
  execute $p$
    create policy onboarding_staff_delete on storage.objects
      for delete to authenticated
      using (bucket_id = 'onboarding' and (select public.can_manage_onboarding()))
  $p$;
end $$;

notify pgrst, 'reload schema';
