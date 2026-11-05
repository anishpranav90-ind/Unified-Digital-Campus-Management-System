-- Allow common consumer email providers alongside the campus domain.
-- Keep this list in sync with the defaults in src/lib/auth/institutional-email.ts
-- and INSTITUTIONAL_EMAIL_DOMAINS.
insert into public.institutional_email_domains (domain)
values
  ('gmail.com'),
  ('googlemail.com'),
  ('yahoo.com'),
  ('yahoo.co.in'),
  ('ymail.com'),
  ('outlook.com'),
  ('hotmail.com'),
  ('live.com'),
  ('icloud.com'),
  ('rediffmail.com'),
  ('protonmail.com'),
  ('proton.me'),
  ('zoho.com')
on conflict (domain) do nothing;

comment on table public.institutional_email_domains is
  'Exact email domains allowed to sign in and register. Keep synchronized with INSTITUTIONAL_EMAIL_DOMAINS.';

create or replace function public.enforce_auth_institutional_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_institutional_email(new.email) then
    raise exception using errcode = '23514', message = 'Use an approved email address.';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_profile_institutional_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_institutional_email(new.email) then
    raise exception using errcode = '23514', message = 'Use an approved email address.';
  end if;
  return new;
end;
$$;
