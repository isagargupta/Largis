-- This project does not auto-expose new tables to the Data API, so table privileges are granted
-- explicitly. Row Level Security from 0001 still filters every row these roles can touch.

grant usage on schema public to anon, authenticated, service_role;

-- Website visitors may submit enquiries; nobody reads them through the public API.
grant insert on public.contact_submissions to anon, authenticated;

-- Signed-in portal users; RLS limits them to their own organizations and role.
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.memberships   to authenticated;
grant select, insert, update, delete on public.leads         to authenticated;

grant execute on function public.org_role_for(uuid)  to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;

-- Server-side admin tasks (creating client organizations, staff inbox).
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
