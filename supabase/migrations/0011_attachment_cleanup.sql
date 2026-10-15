-- Files that were uploaded but never sent: the uploader may delete them, and a daily job removes
-- whatever is left after a day. A file is "in use" once any chat message, ticket, or reply lists it.

create or replace function public.attachment_in_use(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.chat_messages
      where attachments <> '[]'::jsonb and attachments @> jsonb_build_array(jsonb_build_object('path', p_path))
    )
    or exists (
      select 1 from public.ticket_messages
      where attachments <> '[]'::jsonb and attachments @> jsonb_build_array(jsonb_build_object('path', p_path))
    )
    or exists (
      select 1 from public.support_tickets
      where attachments <> '[]'::jsonb and attachments @> jsonb_build_array(jsonb_build_object('path', p_path))
    );
$$;

revoke all on function public.attachment_in_use(text) from public, anon;
grant execute on function public.attachment_in_use(text) to authenticated, service_role;

drop policy if exists attachments_delete_unsent on storage.objects;
create policy attachments_delete_unsent on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and owner_id = (select auth.uid()::text)
    and not public.attachment_in_use(name)
  );

create or replace function public.stale_attachments(p_older_than interval default interval '24 hours', p_limit integer default 500)
returns setof text
language sql
stable
security definer
set search_path = public, storage
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'attachments'
    and o.created_at < now() - p_older_than
    and not public.attachment_in_use(o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke all on function public.stale_attachments(interval, integer) from public, anon, authenticated;
grant execute on function public.stale_attachments(interval, integer) to service_role;
