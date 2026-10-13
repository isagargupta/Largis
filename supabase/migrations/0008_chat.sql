-- Largis Venture — live chat between each client organization and the Largis team.
-- Applies on top of 0001–0007. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One conversation per client organization; every member and every active staff member takes part.
create table if not exists public.chat_messages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  author_id        uuid references auth.users (id) on delete set null default auth.uid(),
  author_kind      text not null check (author_kind in ('client', 'staff')),
  body             text not null check (char_length(body) between 1 and 4000),
  created_at       timestamptz not null default now()
);

create index if not exists chat_messages_org_created_idx on public.chat_messages (organization_id, created_at desc);
create index if not exists chat_messages_author_created_idx on public.chat_messages (author_id, created_at desc);

-- Per-person read position, used for unread counts.
create table if not exists public.chat_reads (
  user_id          uuid not null references auth.users (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  last_read_at     timestamptz not null default now(),
  primary key (user_id, organization_id)
);

-- ---------------------------------------------------------------------------
-- Functions and triggers
-- ---------------------------------------------------------------------------

-- The author is always the signed-in user; their side is derived, never supplied.
create or replace function public.chat_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.author_id := auth.uid();
    new.author_kind := case when public.is_staff() then 'staff' else 'client' end;

    if (
      select count(*) from public.chat_messages
      where author_id = auth.uid() and created_at > now() - interval '1 minute'
    ) >= 30 then
      raise exception 'You are sending messages too quickly. Please wait a moment.' using errcode = 'P0001';
    end if;
  end if;

  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists chat_messages_before_insert on public.chat_messages;
create trigger chat_messages_before_insert
before insert on public.chat_messages
for each row execute function public.chat_messages_before_insert();

-- Unread messages from the other side, per conversation, for the caller. A conversation counts as read
-- up to the caller's own read position or the latest reply from their side, whichever is later.
create or replace function public.chat_unread_counts()
returns table (organization_id uuid, unread integer)
language sql
stable
set search_path = public
as $$
  with side as (
    select case when public.is_staff() then 'staff' else 'client' end as mine
  ),
  own as (
    select m.organization_id, max(m.created_at) as at
    from public.chat_messages m, side
    where m.author_kind = side.mine
    group by m.organization_id
  )
  select m.organization_id, count(*)::integer
  from public.chat_messages m
  cross join side
  left join public.chat_reads r on r.organization_id = m.organization_id and r.user_id = auth.uid()
  left join own on own.organization_id = m.organization_id
  where auth.uid() is not null
    and m.author_kind <> side.mine
    and m.created_at > coalesce(greatest(r.last_read_at, own.at), '-infinity'::timestamptz)
  group by m.organization_id
$$;

-- Latest message per conversation the caller can see (staff: every client).
create or replace function public.chat_conversations()
returns table (organization_id uuid, organization_name text, last_body text, last_author_kind text, last_at timestamptz)
language sql
stable
set search_path = public
as $$
  select distinct on (m.organization_id)
    m.organization_id, o.name, m.body, m.author_kind, m.created_at
  from public.chat_messages m
  join public.organizations o on o.id = m.organization_id
  where auth.uid() is not null
  order by m.organization_id, m.created_at desc
$$;

create or replace function public.chat_mark_read(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (public.is_staff() or public.is_org_member(p_org)) then
    raise exception 'You do not have access to this conversation' using errcode = '42501';
  end if;

  insert into public.chat_reads (user_id, organization_id, last_read_at)
  values (auth.uid(), p_org, now())
  on conflict (user_id, organization_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.chat_messages enable row level security;
alter table public.chat_reads    enable row level security;

drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select" on public.chat_messages
  for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (public.is_staff() or public.is_org_member(organization_id))
  );

drop policy if exists "chat_reads_own" on public.chat_reads;
create policy "chat_reads_own" on public.chat_reads
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime not found; skipping realtime setup';
    return;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Grants (this project does not auto-grant; see 0002)
-- ---------------------------------------------------------------------------

-- Messages are a record of the conversation: no edits or deletes through the API.
grant select on public.chat_messages to authenticated;
grant insert (organization_id, body) on public.chat_messages to authenticated;
grant select on public.chat_reads to authenticated;

revoke all on function public.chat_messages_before_insert() from public, anon, authenticated;
revoke all on function public.chat_unread_counts()          from public, anon;
revoke all on function public.chat_conversations()          from public, anon;
revoke all on function public.chat_mark_read(uuid)          from public, anon;

grant execute on function public.chat_unread_counts()  to authenticated;
grant execute on function public.chat_conversations()  to authenticated;
grant execute on function public.chat_mark_read(uuid)  to authenticated;

grant all on public.chat_messages, public.chat_reads to service_role;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';
