-- Send welcome emails once for confirmed accounts, with a retryable claim.
alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists welcome_email_claim_token uuid,
  add column if not exists welcome_email_claimed_at timestamptz;

create or replace function public.claim_welcome_email(p_user_id uuid, p_claim_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
     set welcome_email_claim_token = p_claim_token,
         welcome_email_claimed_at = pg_catalog.now()
   where p.id = p_user_id
     and p.welcome_email_sent_at is null
     and (
       p.welcome_email_claimed_at is null
       or p.welcome_email_claimed_at < pg_catalog.now() - interval '15 minutes'
     )
     and exists (
       select 1
         from auth.users u
        where u.id = p.id
          and u.email_confirmed_at is not null
     );

  return found;
end;
$$;

create or replace function public.finish_welcome_email(
  p_user_id uuid,
  p_claim_token uuid,
  p_sent boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
     set welcome_email_sent_at = case
           when p_sent then pg_catalog.now()
           else p.welcome_email_sent_at
         end,
         welcome_email_claim_token = null,
         welcome_email_claimed_at = null
   where p.id = p_user_id
     and p.welcome_email_claim_token = p_claim_token;

  return found;
end;
$$;

revoke all on function public.claim_welcome_email(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_welcome_email(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_welcome_email(uuid, uuid) to service_role;
grant execute on function public.finish_welcome_email(uuid, uuid, boolean) to service_role;
