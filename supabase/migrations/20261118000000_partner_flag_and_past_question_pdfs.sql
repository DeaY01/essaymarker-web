-- Partner-only commissions, and past questions as one PDF per exam body + year.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Partners are approved manually: set is_partner = true in the Table Editor.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_partner boolean not null default false;

-- Partners (e.g. tutorial centres) may be given a custom, memorable referral
-- code, so allow 4–20 uppercase letters/digits instead of exactly 8.
alter table public.profiles drop constraint if exists profiles_referral_code_check;
alter table public.profiles
  add constraint profiles_referral_code_check check (referral_code ~ '^[A-Z0-9]{4,20}$');

-- Same as before, except the 10% commission is only logged when the referrer
-- is an approved partner. Students still get their units either way.
create or replace function public.complete_payment(
  p_reference text,
  p_amount_kobo integer,
  p_paystack_transaction_id bigint,
  p_paid_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_referrer uuid;
begin
  update public.payments
     set status = 'success',
         paystack_transaction_id = p_paystack_transaction_id,
         paid_at = coalesce(p_paid_at, now())
   where reference = p_reference
     and status = 'pending'
     and amount_kobo = p_amount_kobo
  returning * into v_payment;

  if not found then
    return false;
  end if;

  update public.profiles
     set credits = credits + v_payment.units,
         activated_at = coalesce(activated_at, now()),
         updated_at = now()
   where id = v_payment.user_id
  returning referred_by into v_referrer;

  if v_referrer is not null
     and exists (select 1 from public.profiles where id = v_referrer and is_partner) then
    insert into public.affiliate_commissions (referrer_id, referred_user_id, payment_id, amount_kobo)
    values (v_referrer, v_payment.user_id, v_payment.id, (v_payment.amount_kobo / 10))
    on conflict (payment_id) do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.complete_payment(text, integer, bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.complete_payment(text, integer, bigint, timestamptz) to service_role;

-- Only partners can request payouts (the /partners page is hidden from others).
create or replace function public.request_payout(
  p_bank_name text,
  p_account_number text,
  p_account_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_available bigint;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  -- Serialise requests from the same partner.
  perform 1 from public.profiles where id = v_user and is_partner for update;
  if not found then
    raise exception 'Not a partner';
  end if;

  if exists (select 1 from public.payout_requests where user_id = v_user and status = 'pending') then
    raise exception 'A payout request is already pending';
  end if;

  select available_kobo into v_available from public.affiliate_summary();
  if coalesce(v_available, 0) < 100000 then
    raise exception 'The minimum payout is ₦1,000';
  end if;

  insert into public.payout_requests (user_id, amount_kobo, bank_name, account_number, account_name)
  values (v_user, v_available, trim(p_bank_name), trim(p_account_number), trim(p_account_name))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.request_payout(text, text, text) from public, anon;
grant execute on function public.request_payout(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Past questions: one row per exam body + year, pointing at a PDF in the
--    private `past-questions` Storage bucket.
--    This replaces the earlier question-by-question table, and DROPS ANY ROWS
--    already in it.
-- ---------------------------------------------------------------------------

do $$
begin
  -- Only rebuild the old shape (it has a `question` column); a re-run is a no-op.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'past_questions' and column_name = 'question'
  ) then
    drop table public.past_questions;
  end if;
end;
$$;

create table if not exists public.past_questions (
  id uuid primary key default gen_random_uuid(),
  exam_body text not null check (exam_body in ('WAEC', 'NECO')),
  exam_year integer not null check (exam_year between 1980 and 2100),
  -- Object path inside the `past-questions` bucket, e.g. 'WAEC-2024.pdf'.
  file_path text not null check (char_length(file_path) between 1 and 300),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (exam_body, exam_year)
);

alter table public.past_questions enable row level security;

drop policy if exists "Signed-in users can read published past questions" on public.past_questions;
create policy "Signed-in users can read published past questions"
  on public.past_questions for select
  to authenticated
  using (is_published);

-- Private bucket: files are only reachable through short-lived signed URLs.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('past-questions', 'past-questions', false, array['application/pdf'])
on conflict (id) do update
  set public = false, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Signed-in users can read past question PDFs" on storage.objects;
create policy "Signed-in users can read past question PDFs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'past-questions');
