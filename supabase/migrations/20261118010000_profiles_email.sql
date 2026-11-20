-- Shows each account's email in public.profiles, so admins can find a person
-- in the Table Editor and tick `is_partner` without writing SQL.
-- Kept in sync with auth.users automatically. Safe to run more than once.

alter table public.profiles add column if not exists email text;

create index if not exists profiles_email_idx on public.profiles (lower(email));

-- Fill in existing accounts.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

-- New accounts: same as before, plus the email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer uuid;
begin
  select id into v_referrer
    from public.profiles
   where referral_code = upper(nullif(trim(new.raw_user_meta_data ->> 'referral_code'), ''));

  insert into public.profiles (id, credits, referral_code, referred_by, email)
  values (new.id, 5, public.generate_referral_code(), v_referrer, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- When someone changes their email, update it here too.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email, updated_at = now() where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

revoke all on function public.sync_profile_email() from public, anon, authenticated;
