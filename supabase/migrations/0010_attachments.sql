-- Largis Venture — file attachments on chat messages, support tickets, and ticket replies.
-- Files live in the private "attachments" bucket at {organization_id}/{random uuid}/{file name}.
-- The sender uploads first, then lists the files on the message; the database checks each one.
-- Applies on top of 0001–0009. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.chat_messages   add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.ticket_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.support_tickets add column if not exists attachments jsonb not null default '[]'::jsonb;

-- A message may be only files.
alter table public.chat_messages drop constraint if exists chat_messages_body_check;
alter table public.chat_messages add constraint chat_messages_body_check
  check (char_length(body) <= 4000 and (char_length(body) >= 1 or jsonb_array_length(attachments) > 0));

alter table public.ticket_messages drop constraint if exists ticket_messages_body_check;
alter table public.ticket_messages add constraint ticket_messages_body_check
  check (char_length(body) <= 10000 and (char_length(body) >= 1 or jsonb_array_length(attachments) > 0));

create index if not exists chat_messages_attachments_idx on public.chat_messages
  using gin (attachments jsonb_path_ops) where attachments <> '[]'::jsonb;
create index if not exists ticket_messages_attachments_idx on public.ticket_messages
  using gin (attachments jsonb_path_ops) where attachments <> '[]'::jsonb;
create index if not exists support_tickets_attachments_idx on public.support_tickets
  using gin (attachments jsonb_path_ops) where attachments <> '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Validation: every listed file must be the caller's own upload in this organization's folder.
-- Name, type, and size are taken from storage, not from the client.
-- ---------------------------------------------------------------------------

create or replace function public.attachments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  obj record;
  checked jsonb := '[]'::jsonb;
  file_path text;
  file_name text;
begin
  if new.attachments is null or new.attachments = '[]'::jsonb then
    new.attachments := '[]'::jsonb;
    return new;
  end if;
  if jsonb_typeof(new.attachments) <> 'array' or jsonb_array_length(new.attachments) > 5 then
    raise exception 'Attach up to 5 files at a time.' using errcode = 'P0001';
  end if;

  for item in select value from jsonb_array_elements(new.attachments) loop
    file_path := item->>'path';
    if file_path is null
       or file_path !~ ('^' || new.organization_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,120}$')
    then
      raise exception 'An attachment is invalid. Remove it and try again.' using errcode = 'P0001';
    end if;

    select o.owner_id, o.metadata into obj
    from storage.objects o
    where o.bucket_id = 'attachments' and o.name = file_path;
    if not found or (auth.uid() is not null and obj.owner_id is distinct from auth.uid()::text) then
      raise exception 'An attachment did not finish uploading. Remove it and try again.' using errcode = 'P0001';
    end if;

    file_name := left(regexp_replace(coalesce(nullif(btrim(item->>'name'), ''), split_part(file_path, '/', 3)), '[[:cntrl:]/\\]', '', 'g'), 200);
    checked := checked || jsonb_build_array(jsonb_build_object(
      'path', file_path,
      'name', coalesce(nullif(file_name, ''), split_part(file_path, '/', 3)),
      'type', coalesce(obj.metadata->>'mimetype', 'application/octet-stream'),
      'size', coalesce((obj.metadata->>'size')::bigint, 0)
    ));
  end loop;

  new.attachments := checked;
  return new;
end;
$$;

-- Named to run after each table's existing before-insert trigger, which sets organization_id.
drop trigger if exists chat_messages_files on public.chat_messages;
create trigger chat_messages_files
before insert on public.chat_messages
for each row execute function public.attachments_before_insert();

drop trigger if exists ticket_messages_files on public.ticket_messages;
create trigger ticket_messages_files
before insert on public.ticket_messages
for each row execute function public.attachments_before_insert();

drop trigger if exists support_tickets_files on public.support_tickets;
create trigger support_tickets_files
before insert on public.support_tickets
for each row execute function public.attachments_before_insert();

-- ---------------------------------------------------------------------------
-- Storage access
-- ---------------------------------------------------------------------------

create or replace function public.can_upload_attachment(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if auth.uid() is null then
    return false;
  end if;
  parts := string_to_array(coalesce(p_name, ''), '/');
  if coalesce(array_length(parts, 1), 0) <> 3
     or parts[1] !~ uuid_re
     or parts[2] !~ uuid_re
     or parts[3] !~ '^[A-Za-z0-9._-]{1,120}$'
  then
    return false;
  end if;
  return public.is_staff() or public.is_org_member(parts[1]::uuid);
end;
$$;

-- Staff read everything; members read files on messages they can see (never on internal notes).
create or replace function public.can_read_attachment(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  org uuid;
  probe jsonb;
begin
  if auth.uid() is null then
    return false;
  end if;
  if public.is_staff() then
    return true;
  end if;
  parts := string_to_array(coalesce(p_name, ''), '/');
  if coalesce(array_length(parts, 1), 0) <> 3
     or parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return false;
  end if;
  org := parts[1]::uuid;
  if not public.is_org_member(org) then
    return false;
  end if;
  probe := jsonb_build_array(jsonb_build_object('path', p_name));
  return exists (select 1 from public.chat_messages where organization_id = org and attachments @> probe)
      or exists (select 1 from public.support_tickets where organization_id = org and attachments @> probe)
      or exists (select 1 from public.ticket_messages where organization_id = org and not internal and attachments @> probe);
end;
$$;

do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Storage schema not found; skipping the attachments bucket and its policies';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('attachments', 'attachments', false, 10485760, array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "attachments_insert" on storage.objects';
  execute $p$
    create policy "attachments_insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'attachments' and public.can_upload_attachment(name))
  $p$;

  -- Uploaders can read their own file before it is sent (for previews).
  execute 'drop policy if exists "attachments_read" on storage.objects';
  execute $p$
    create policy "attachments_read" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'attachments'
        and (owner_id = (select auth.uid()::text) or public.can_read_attachment(name))
      )
  $p$;
end $$;

-- ---------------------------------------------------------------------------
-- Conversation previews: show something for file-only messages.
-- ---------------------------------------------------------------------------

create or replace function public.chat_conversations()
returns table (organization_id uuid, organization_name text, last_body text, last_author_kind text, last_at timestamptz)
language sql
stable
set search_path = public
as $$
  select distinct on (m.organization_id)
    m.organization_id,
    o.name,
    case
      when m.body <> '' then m.body
      when jsonb_array_length(m.attachments) = 1 then 'Sent a file: ' || (m.attachments->0->>'name')
      else 'Sent ' || jsonb_array_length(m.attachments) || ' files'
    end,
    m.author_kind,
    m.created_at
  from public.chat_messages m
  join public.organizations o on o.id = m.organization_id
  where auth.uid() is not null
  order by m.organization_id, m.created_at desc
$$;

-- ---------------------------------------------------------------------------
-- Grants (this project does not auto-grant; see 0002)
-- ---------------------------------------------------------------------------

grant insert (attachments) on public.chat_messages   to authenticated;
grant insert (attachments) on public.ticket_messages to authenticated;
grant insert (attachments) on public.support_tickets to authenticated;

revoke all on function public.attachments_before_insert() from public, anon, authenticated;
revoke all on function public.can_upload_attachment(text) from public, anon;
revoke all on function public.can_read_attachment(text)   from public, anon;
grant execute on function public.can_upload_attachment(text) to authenticated;
grant execute on function public.can_read_attachment(text)   to authenticated;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';
