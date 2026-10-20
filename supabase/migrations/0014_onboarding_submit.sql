-- Marking a joining form submitted runs the check trigger as the API role.
-- That role could not execute the trigger, so Postgres returned "permission denied"
-- and the record stayed open.

grant select, insert, update, delete on public.employee_onboardings to authenticated;
grant all on public.employee_onboardings to service_role;

grant execute on function public.touch_updated_at() to authenticated, service_role;

revoke all on function public.onboarding_file_ok(jsonb, uuid, text) from public, anon;
grant execute on function public.onboarding_file_ok(jsonb, uuid, text) to authenticated, service_role;

create or replace function public.employee_onboardings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- Saves the submission as the database owner, so the employee's link does not need
-- staff permission to mark the form submitted.
create or replace function public.onboarding_submit(p_id uuid, p_patch jsonb, p_require_open boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  updated uuid;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role'
     and not public.can_manage_onboarding() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.employee_onboardings set
    full_name = nullif(p_patch->>'full_name', ''),
    father_name = nullif(p_patch->>'father_name', ''),
    mother_name = nullif(p_patch->>'mother_name', ''),
    date_of_birth = nullif(p_patch->>'date_of_birth', '')::date,
    gender = nullif(p_patch->>'gender', ''),
    marital_status = nullif(p_patch->>'marital_status', ''),
    blood_group = nullif(p_patch->>'blood_group', ''),
    nationality = nullif(p_patch->>'nationality', ''),
    email = nullif(p_patch->>'email', ''),
    phone = nullif(p_patch->>'phone', ''),
    alternate_phone = nullif(p_patch->>'alternate_phone', ''),
    address_line1 = nullif(p_patch->>'address_line1', ''),
    address_line2 = nullif(p_patch->>'address_line2', ''),
    city = nullif(p_patch->>'city', ''),
    state = nullif(p_patch->>'state', ''),
    pin_code = nullif(p_patch->>'pin_code', ''),
    permanent_same = nullif(p_patch->>'permanent_same', '')::boolean,
    permanent_line1 = nullif(p_patch->>'permanent_line1', ''),
    permanent_line2 = nullif(p_patch->>'permanent_line2', ''),
    permanent_city = nullif(p_patch->>'permanent_city', ''),
    permanent_state = nullif(p_patch->>'permanent_state', ''),
    permanent_pin = nullif(p_patch->>'permanent_pin', ''),
    emergency_name = nullif(p_patch->>'emergency_name', ''),
    emergency_relation = nullif(p_patch->>'emergency_relation', ''),
    emergency_phone = nullif(p_patch->>'emergency_phone', ''),
    aadhaar = nullif(p_patch->>'aadhaar', ''),
    pan = nullif(p_patch->>'pan', ''),
    account_holder = nullif(p_patch->>'account_holder', ''),
    account_number = nullif(p_patch->>'account_number', ''),
    ifsc = nullif(p_patch->>'ifsc', ''),
    bank_name = nullif(p_patch->>'bank_name', ''),
    branch_name = nullif(p_patch->>'branch_name', ''),
    account_type = nullif(p_patch->>'account_type', ''),
    tenth_board = nullif(p_patch->>'tenth_board', ''),
    tenth_school = nullif(p_patch->>'tenth_school', ''),
    tenth_year = nullif(p_patch->>'tenth_year', '')::smallint,
    tenth_score = nullif(p_patch->>'tenth_score', ''),
    twelfth_board = nullif(p_patch->>'twelfth_board', ''),
    twelfth_school = nullif(p_patch->>'twelfth_school', ''),
    twelfth_year = nullif(p_patch->>'twelfth_year', '')::smallint,
    twelfth_score = nullif(p_patch->>'twelfth_score', ''),
    has_college = nullif(p_patch->>'has_college', '')::boolean,
    college_degree = nullif(p_patch->>'college_degree', ''),
    college_name = nullif(p_patch->>'college_name', ''),
    college_year = nullif(p_patch->>'college_year', '')::smallint,
    college_score = nullif(p_patch->>'college_score', ''),
    designation = nullif(p_patch->>'designation', ''),
    department = nullif(p_patch->>'department', ''),
    employment_type = nullif(p_patch->>'employment_type', ''),
    joining_date = nullif(p_patch->>'joining_date', '')::date,
    work_mode = nullif(p_patch->>'work_mode', ''),
    experience_years = nullif(p_patch->>'experience_years', '')::numeric,
    previous_employer = nullif(p_patch->>'previous_employer', ''),
    previous_designation = nullif(p_patch->>'previous_designation', ''),
    uan = nullif(p_patch->>'uan', ''),
    esi_number = nullif(p_patch->>'esi_number', ''),
    languages = nullif(p_patch->>'languages', ''),
    shift_preference = nullif(p_patch->>'shift_preference', ''),
    declaration_accepted = coalesce((p_patch->>'declaration_accepted')::boolean, false),
    documents = case
      when coalesce((p_patch->>'has_college')::boolean, false) then documents
      else documents - 'college'
    end,
    status = case when status = 'reviewed' then status else 'submitted' end,
    submitted_at = case when status = 'open' then now() else submitted_at end
  where id = p_id
    and (not p_require_open or (status = 'open' and expires_at > now()))
    and (p_require_open or status <> 'revoked')
  returning id into updated;

  if updated is null then
    raise exception 'This form could not be saved.' using errcode = 'P0001';
  end if;
  return updated;
end;
$$;

revoke all on function public.onboarding_submit(uuid, jsonb, boolean) from public, anon;
grant execute on function public.onboarding_submit(uuid, jsonb, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
