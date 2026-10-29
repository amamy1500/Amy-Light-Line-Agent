/**
 * Recreates the parts of a Supabase database our migrations rely on (roles
 * and auth.uid()) inside an embedded Postgres, for local development and
 * tests. Never applied to a real Supabase project, which already has them.
 *
 * auth.uid() reads the same setting Supabase's PostgREST sets per request,
 * so tests can impersonate a user with:
 *   set local role authenticated;
 *   select set_config('request.jwt.claim.sub', '<uuid>', true);
 */
export const SUPABASE_SHIM_SQL = `
do $shim$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$shim$;

create schema if not exists auth;

create or replace function auth.uid() returns uuid
language sql stable as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;
