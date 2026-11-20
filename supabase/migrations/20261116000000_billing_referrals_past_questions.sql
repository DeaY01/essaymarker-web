-- Units, Paystack payments, the referral (partner) programme, and past questions.
-- Money is stored in kobo (₦1 = 100 kobo) as integers. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Profiles: unit balance, referral code and who referred the user.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  credits integer not null default 5 check (credits >= 0),
  -- Set on the first successful payment. Paid accounts keep Learn access at 0 units.
  activated_at timestamptz,
  -- Shareable code used in links like /sign-up?ref=AB12CD34.
  referral_code text not null unique check (referral_code ~ '^[A-Z0-9]{8}$'),
  referred_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referred_by is null or referred_by <> id)
);

create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

alter table public.profiles enable row level security;

-- Students may read their own profile only. No insert/update/delete policies:
-- balances and referral links change only through the functions below.
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- Random 8-character code without look-alike characters (no 0/O, 1/I/L).
create or replace function public.generate_referral_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end;
$$;

-- New accounts get 5 free units and a referral code. If they signed up through
-- a partner's link, the app passes that code in the sign-up metadata.
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

  insert into public.profiles (id, credits, referral_code, referred_by)
  values (new.id, 5, public.generate_referral_code(), v_referrer)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts created before this migration get their 5 units and a code too.
insert into public.profiles (id, credits, referral_code)
select u.id, 5, public.generate_referral_code()
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------------
-- 2. Unit accounting. Only the server (service role) may call these.
-- ---------------------------------------------------------------------------

-- Takes one unit before marking; returns the new balance, or null if none left.
create or replace function public.reserve_credit(p_user_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set credits = credits - 1, updated_at = now()
   where id = p_user_id and credits > 0
  returning credits;
$$;

-- Gives back a unit reserved for a marking that failed.
create or replace function public.refund_credit(p_user_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set credits = credits + 1, updated_at = now()
   where id = p_user_id
  returning credits;
$$;

revoke all on function public.reserve_credit(uuid) from public, anon, authenticated;
revoke all on function public.refund_credit(uuid) from public, anon, authenticated;
grant execute on function public.reserve_credit(uuid) to service_role;
grant execute on function public.refund_credit(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Paystack payments.
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Our reference, sent to Paystack and echoed back in the webhook.
  reference text not null unique,
  amount_kobo integer not null check (amount_kobo > 0),
  units integer not null check (units > 0),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  paystack_transaction_id bigint,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_created_idx on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

drop policy if exists "Users can read their own payments" on public.payments;
create policy "Users can read their own payments"
  on public.payments for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Marks a payment successful exactly once: adds its units, activates the
-- account and records the referrer's 10% commission. Returns true only on the
-- call that completed it, so the webhook and the return page can both call it.
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

  if v_referrer is not null then
    insert into public.affiliate_commissions (referrer_id, referred_user_id, payment_id, amount_kobo)
    values (v_referrer, v_payment.user_id, v_payment.id, (v_payment.amount_kobo / 10))
    on conflict (payment_id) do nothing;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Referral commissions and payouts.
-- ---------------------------------------------------------------------------

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_user_id uuid references public.profiles (id) on delete set null,
  payment_id uuid not null unique references public.payments (id) on delete cascade,
  amount_kobo integer not null check (amount_kobo > 0),
  created_at timestamptz not null default now()
);

create index if not exists affiliate_commissions_referrer_idx
  on public.affiliate_commissions (referrer_id, created_at desc);

alter table public.affiliate_commissions enable row level security;

drop policy if exists "Partners can read their own commissions" on public.affiliate_commissions;
create policy "Partners can read their own commissions"
  on public.affiliate_commissions for select
  to authenticated
  using ((select auth.uid()) = referrer_id);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_kobo integer not null check (amount_kobo > 0),
  bank_name text not null check (char_length(bank_name) between 2 and 100),
  account_number text not null check (account_number ~ '^[0-9]{10}$'),
  account_name text not null check (char_length(account_name) between 2 and 100),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payout_requests_user_created_idx
  on public.payout_requests (user_id, created_at desc);

alter table public.payout_requests enable row level security;

drop policy if exists "Partners can read their own payout requests" on public.payout_requests;
create policy "Partners can read their own payout requests"
  on public.payout_requests for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Earnings for the signed-in partner. Only ever returns the caller's own figures.
create or replace function public.affiliate_summary()
returns table (
  referral_code text,
  referrals_count integer,
  purchases_count integer,
  total_earned_kobo bigint,
  paid_out_kobo bigint,
  pending_payout_kobo bigint,
  available_kobo bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  earned as (
    select count(*)::int as purchases, coalesce(sum(amount_kobo), 0)::bigint as total
      from public.affiliate_commissions, me where referrer_id = me.id
  ),
  payouts as (
    select
      coalesce(sum(amount_kobo) filter (where status = 'paid'), 0)::bigint as paid,
      coalesce(sum(amount_kobo) filter (where status = 'pending'), 0)::bigint as pending
      from public.payout_requests, me where user_id = me.id
  )
  select
    p.referral_code,
    (select count(*)::int from public.profiles r where r.referred_by = p.id),
    earned.purchases,
    earned.total,
    payouts.paid,
    payouts.pending,
    earned.total - payouts.paid - payouts.pending
  from public.profiles p, me, earned, payouts
  where p.id = me.id;
$$;

revoke all on function public.affiliate_summary() from public, anon;
grant execute on function public.affiliate_summary() to authenticated;

-- A partner asks to withdraw their whole available balance. The amount is
-- worked out here, never taken from the client. Minimum ₦1,000; one at a time.
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
  perform 1 from public.profiles where id = v_user for update;

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

-- Admin, after sending the money:  select public.mark_payout_paid('<payout id>');
create or replace function public.mark_payout_paid(p_payout_id uuid, p_admin_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payout_requests
     set status = 'paid', processed_at = now(), admin_note = coalesce(p_admin_note, '')
   where id = p_payout_id and status = 'pending';
  if not found then
    raise exception 'Payout % not found or already processed', p_payout_id;
  end if;
end;
$$;

-- Admin, to decline (the amount returns to the partner's available balance).
create or replace function public.reject_payout(p_payout_id uuid, p_admin_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payout_requests
     set status = 'rejected', processed_at = now(), admin_note = coalesce(p_admin_note, '')
   where id = p_payout_id and status = 'pending';
  if not found then
    raise exception 'Payout % not found or already processed', p_payout_id;
  end if;
end;
$$;

revoke all on function public.complete_payment(text, integer, bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_payout_paid(uuid, text) from public, anon, authenticated;
revoke all on function public.reject_payout(uuid, text) from public, anon, authenticated;
revoke all on function public.generate_referral_code() from public, anon, authenticated;
grant execute on function public.complete_payment(text, integer, bigint, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Past questions, managed by admins in the Supabase Table Editor.
-- ---------------------------------------------------------------------------

create table if not exists public.past_questions (
  id uuid primary key default gen_random_uuid(),
  exam_body text not null check (exam_body in ('WAEC', 'NECO')),
  exam_year smallint not null check (exam_year between 1980 and 2100),
  sitting text not null default '',          -- e.g. "May/June", "Nov/Dec"
  question_number smallint check (question_number > 0),
  essay_type text not null default '',       -- e.g. "Formal letter", "Argumentative"
  question text not null check (char_length(question) between 10 and 4000),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists past_questions_listing_idx
  on public.past_questions (exam_body, exam_year desc, question_number)
  where is_published;

alter table public.past_questions enable row level security;

drop policy if exists "Signed-in users can read published past questions" on public.past_questions;
create policy "Signed-in users can read published past questions"
  on public.past_questions for select
  to authenticated
  using (is_published);
