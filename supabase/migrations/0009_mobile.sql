-- Largis Venture — mobile app: push notification device tokens.
-- Applies on top of 0001–0008. Safe to re-run.

-- One row per installed app. A device that signs in as someone else moves to that account.
create table if not exists public.device_tokens (
  token       text primary key check (char_length(token) between 10 and 200),
  user_id     uuid not null references auth.users (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_own" on public.device_tokens;
create policy "device_tokens_own" on public.device_tokens
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.register_device_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to register this device' using errcode = '42501';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' or p_platform not in ('ios', 'android') then
    raise exception 'That device token is not valid' using errcode = '22023';
  end if;

  insert into public.device_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.unregister_device_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.device_tokens where token = p_token and user_id = auth.uid()
$$;

grant select on public.device_tokens to authenticated;

revoke all on function public.register_device_token(text, text) from public, anon;
revoke all on function public.unregister_device_token(text)     from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;
grant execute on function public.unregister_device_token(text)     to authenticated;

grant all on public.device_tokens to service_role;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';
