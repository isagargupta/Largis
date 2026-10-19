-- Largis AI: an internal assistant for staff that answers from a company knowledge base.
-- Admins and managers maintain the knowledge base (articles and uploaded documents); every staff
-- member can ask questions. Conversations are private to the staff member who had them.

create extension if not exists vector with schema extensions;

create or replace function public.can_manage_knowledge()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.staff_role_for_me() in ('admin', 'manager'), false)
$$;

revoke all on function public.can_manage_knowledge() from public, anon;
grant execute on function public.can_manage_knowledge() to authenticated;

-- ---------------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------------

create table if not exists public.kb_documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 200),
  category     text check (char_length(category) <= 60),
  kind         text not null check (kind in ('article', 'file')),
  body         text not null default '' check (char_length(body) <= 600000),
  file_path    text check (char_length(file_path) <= 300),
  file_name    text check (char_length(file_name) <= 200),
  file_type    text check (char_length(file_type) <= 120),
  file_size    integer check (file_size >= 0),
  status       text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  error        text check (char_length(error) <= 500),
  chunk_count  integer not null default 0,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint kb_documents_file check (kind = 'article' or file_path is not null)
);

create index if not exists kb_documents_updated_idx on public.kb_documents (updated_at desc);
create index if not exists kb_documents_category_idx on public.kb_documents (category);

create table if not exists public.kb_chunks (
  id           bigint generated always as identity primary key,
  document_id  uuid not null references public.kb_documents (id) on delete cascade,
  chunk_index  integer not null,
  heading      text check (char_length(heading) <= 300),
  content      text not null check (char_length(content) <= 8000),
  embedding    extensions.vector(1536) not null,
  fts          tsvector generated always as (to_tsvector('english', coalesce(heading, '') || ' ' || content)) stored,
  unique (document_id, chunk_index)
);

create index if not exists kb_chunks_embedding_idx on public.kb_chunks
  using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists kb_chunks_fts_idx on public.kb_chunks using gin (fts);

alter table public.kb_documents enable row level security;
alter table public.kb_chunks enable row level security;

drop policy if exists kb_documents_read on public.kb_documents;
create policy kb_documents_read on public.kb_documents
  for select to authenticated using ((select public.is_staff()));

drop policy if exists kb_documents_write on public.kb_documents;
create policy kb_documents_write on public.kb_documents
  for all to authenticated
  using ((select public.can_manage_knowledge()))
  with check ((select public.can_manage_knowledge()));

drop policy if exists kb_chunks_read on public.kb_chunks;
create policy kb_chunks_read on public.kb_chunks
  for select to authenticated using ((select public.is_staff()));

drop policy if exists kb_chunks_write on public.kb_chunks;
create policy kb_chunks_write on public.kb_chunks
  for all to authenticated
  using ((select public.can_manage_knowledge()))
  with check ((select public.can_manage_knowledge()));

grant select, insert, update, delete on public.kb_documents to authenticated;
grant select, insert, delete on public.kb_chunks to authenticated;

/**
 * Hybrid search: meaning (vector similarity) and exact words (full text), merged by reciprocal
 * rank fusion. Runs as the caller, so only staff get results.
 */
create or replace function public.kb_search(p_embedding extensions.vector(1536), p_query text, p_count integer default 8)
returns table (
  chunk_id bigint,
  document_id uuid,
  title text,
  category text,
  heading text,
  content text,
  updated_at timestamptz,
  similarity double precision,
  keyword_match boolean,
  score double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with semantic as (
    select c.id, row_number() over (order by c.embedding <=> p_embedding) as rank,
           1 - (c.embedding <=> p_embedding) as similarity
    from public.kb_chunks c
    order by c.embedding <=> p_embedding
    limit 40
  ),
  keyword as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, q) desc) as rank
    from public.kb_chunks c, websearch_to_tsquery('english', coalesce(p_query, '')) q
    where c.fts @@ q
    order by ts_rank_cd(c.fts, q) desc
    limit 40
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           s.similarity,
           k.id is not null as keyword_match,
           coalesce(1.0 / (60 + s.rank), 0) + coalesce(1.0 / (60 + k.rank), 0) as score
    from semantic s
    full join keyword k on k.id = s.id
  )
  select c.id, c.document_id, d.title, d.category, c.heading, c.content, d.updated_at,
         f.similarity, f.keyword_match, f.score
  from fused f
  join public.kb_chunks c on c.id = f.id
  join public.kb_documents d on d.id = c.document_id
  where d.status = 'ready'
    and (f.keyword_match or f.similarity >= 0.25)
  order by f.score desc
  limit least(greatest(p_count, 1), 20);
$$;

revoke all on function public.kb_search(extensions.vector, text, integer) from public, anon;
grant execute on function public.kb_search(extensions.vector, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Conversations (private to each staff member)
-- ---------------------------------------------------------------------------

create table if not exists public.assistant_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title       text not null default 'New conversation' check (char_length(title) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists assistant_conversations_user_idx on public.assistant_conversations (user_id, updated_at desc);

create table if not exists public.assistant_messages (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references public.assistant_conversations (id) on delete cascade,
  role               text not null check (role in ('user', 'assistant')),
  content            text not null check (char_length(content) <= 20000),
  sources            jsonb not null default '[]'::jsonb,
  answered           boolean,
  feedback           smallint check (feedback in (-1, 1)),
  model              text check (char_length(model) <= 80),
  prompt_tokens      integer,
  completion_tokens  integer,
  created_at         timestamptz not null default now()
);

create index if not exists assistant_messages_conversation_idx on public.assistant_messages (conversation_id, created_at);
create index if not exists assistant_messages_gaps_idx on public.assistant_messages (created_at desc)
  where role = 'assistant' and (answered = false or feedback = -1);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

drop policy if exists assistant_conversations_own on public.assistant_conversations;
create policy assistant_conversations_own on public.assistant_conversations
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_staff()))
  with check (user_id = (select auth.uid()) and (select public.is_staff()));

drop policy if exists assistant_messages_own on public.assistant_messages;
create policy assistant_messages_own on public.assistant_messages
  for all to authenticated
  using (exists (
    select 1 from public.assistant_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ) and (select public.is_staff()))
  with check (exists (
    select 1 from public.assistant_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ) and (select public.is_staff()));

grant select, insert, delete on public.assistant_conversations to authenticated;
grant update (title, updated_at) on public.assistant_conversations to authenticated;
grant select, insert, delete on public.assistant_messages to authenticated;
grant update (feedback) on public.assistant_messages to authenticated;

/** Questions the assistant couldn't answer or that got a thumbs-down, without who asked. */
create or replace function public.assistant_gaps(p_limit integer default 30)
returns table (question text, reason text, asked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select q.content,
         case when a.feedback = -1 then 'unhelpful' else 'not_covered' end,
         a.created_at
  from public.assistant_messages a
  cross join lateral (
    select u.content
    from public.assistant_messages u
    where u.conversation_id = a.conversation_id and u.role = 'user' and u.created_at <= a.created_at
    order by u.created_at desc
    limit 1
  ) q
  where public.can_manage_knowledge()
    and a.role = 'assistant'
    and (a.answered = false or a.feedback = -1)
    and a.created_at > now() - interval '60 days'
  order by a.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.assistant_gaps(integer) from public, anon;
grant execute on function public.assistant_gaps(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Uploaded documents (originals), readable by staff, managed by admins and managers
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge',
  'knowledge',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists knowledge_read on storage.objects;
create policy knowledge_read on storage.objects
  for select to authenticated
  using (bucket_id = 'knowledge' and (select public.is_staff()));

drop policy if exists knowledge_insert on storage.objects;
create policy knowledge_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'knowledge' and (select public.can_manage_knowledge()));

drop policy if exists knowledge_delete on storage.objects;
create policy knowledge_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'knowledge' and (select public.can_manage_knowledge()));
