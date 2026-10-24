-- =============================================================================
-- Fix the profile role guard.
--
-- `guard_profile_write()` is SECURITY DEFINER, so `current_user` inside the
-- trigger is always the function owner (postgres) — the previous bypass check
-- therefore trusted every caller, including a signed-in student promoting
-- themselves through PostgREST. `session_user` is not changed by SECURITY
-- DEFINER, so it reliably distinguishes a direct psql/seed session from a
-- PostgREST request that switched role to `authenticated`.
-- =============================================================================

create or replace function public.guard_profile_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Direct database sessions (migrations, seeds, the SQL editor) run as a
  -- superuser; PostgREST connections arrive as `authenticator` and switch role,
  -- so `session_user` stays untrusted there. The JWT claim covers the
  -- service-role key, which reaches us as `authenticated` over PostgREST.
  if session_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(
       current_setting('request.jwt.claim.role', true),
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
     ) = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() = new.id and new.role <> 'student' then
      raise exception 'New accounts cannot self-assign a privileged role.';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    if auth.uid() = old.id then
      raise exception 'You cannot change your own role.';
    end if;
    if not public.is_admin() then
      raise exception 'Only administrators can change roles.';
    end if;
  end if;

  if new.email is distinct from old.email and not public.is_admin() then
    raise exception 'Email changes must go through account settings.';
  end if;

  return new;
end;
$$;
