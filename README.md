# EssayMarker Web

An isolated Next.js App Router application for evaluating essays with the
WAEC/NECO COEM rubric. The Telegram bot remains a separate project.

## Requirements

- Node.js 20.9 or later
- npm
- An xAI API key
- A Supabase project (free tier is fine)

## Setup

```bash
npm install
```

In PowerShell, copy the environment template:

```powershell
Copy-Item .env.example .env.local
```

Set the required service credentials in `.env.local` as described in the
Accounts and Payments sections below. `XAI_MODEL` defaults to `grok-4.3`.
`DATABASE_URL` is only needed when running SQL migrations from your machine;
the application uses Supabase for its database access.

Run the app with `npm run dev`, then open http://localhost:3000.

## How it works

EssayMarker only accepts **handwritten** essays. Students write on paper, as in
the exam, and upload a photo of each page (up to 5).

1. The browser fixes each photo's orientation, applies any rotation the
   student chose, and compresses it to a JPEG (longest edge 2000 px).
2. `POST /api/evaluate` receives `multipart/form-data` with a `topic` text
   field and one `pages` file per page, in order.
3. A single model call reads the pages and returns, in order: whether they
   are handwritten, their legibility, any photo problems, an exact
   transcription (mistakes kept, unreadable words shown as `[illegible]`), and
   the COEM marks. The server then computes the official word count from the
   transcription and enforces the 0/50 rules below itself, rather than
   trusting the model to return zeros.
4. The report includes the transcription, so students can see what was read.

Student mistakes are never rejected; they are marked down and explained in
`submissionNotes`:

- no pages, typed or printed text instead of handwriting, or unreadable
  handwriting score 0/50 (no marking call is made);
- a missing topic is marked with Content scored conservatively;
- partly illegible handwriting is marked, with illegibility counted against
  Mechanical Accuracy.

An error (`{ "error": string }`) is returned only when no marking could take
place: a typed essay sent as JSON or text, or a file that is not a JPG/PNG
image (415); an unreadable upload (400); photos over the size limit (413); an
unreadable model result (502); missing configuration or provider rate limiting
(503); or a timeout (504). Image types are checked from the file bytes, not
the declared type.

> Hosting note: Vercel limits request bodies to 4.5 MB. Browser compression
> keeps a typical 5-page upload well under that.

## Accounts (Supabase)

The whole app is behind sign-in. Visitors who are not signed in are sent to a
full-screen, branded `/sign-in` page (with links to sign up and reset a
password); after signing in they continue to the page they asked for.

**Setup**

1. Create a project at https://supabase.com.
2. In **Project Settings → API**, copy the Project URL and the publishable
   (anon) key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then restart `npm run dev`.
3. In **Authentication → URL Configuration**, set the Site URL to your site
   (e.g. `http://localhost:3000` in development) and add
   `http://localhost:3000/auth/confirm` (and your production equivalent) to
   the Redirect URLs.
4. In production, set `NEXT_PUBLIC_SITE_URL` so email links use your domain.

Email confirmation is controlled in **Authentication → Providers → Email**.
With it on, new users get a confirmation link; with it off, they are signed in
immediately after sign-up.

**How it works**

- Pages: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`.
- `src/app/(auth)/actions.ts` — Server Actions for sign-up, sign-in, password
  reset and sign-out, with server-side validation. Sign-up and reset requests
  give the same response whether or not an email is registered.
- `src/app/auth/confirm/route.ts` — landing route for email links (supports
  both `?code=` and `?token_hash=` links).
- `src/proxy.ts` — refreshes the session cookie on each request, sends
  signed-out visitors to `/sign-in?next=…`, and sends signed-in users away from
  the sign-in and sign-up pages. API routes are not redirected; they return 401.
- `src/app/(app)/layout.tsx` — header and footer for the signed-in app.
- `src/app/(auth)/layout.tsx` — split-screen branded layout for the auth pages.
- `src/lib/auth.ts` — `getCurrentUser()`, verified with Supabase; use it for
  any server-side authorisation. `POST /api/evaluate` returns 401 without a
  signed-in user.
- Session reads happen behind `<Suspense>`, so every page still has a static
  shell (required by Cache Components).

## Saved reports ("My essays")

Every marking report is saved to the Supabase table `essay_evaluations`,
owned by the signed-in student. Row Level Security limits each student to
reading and deleting their own reports. Only the server (service role key)
saves reports, after a real marking, so students can't insert made-up scores;
reports are never edited.

**Apply the migration once** (Supabase dashboard → SQL Editor → paste and run):

```
supabase/migrations/20261113000000_create_essay_evaluations.sql
```

Or with the Supabase CLI: `supabase db push`.

- `src/lib/essay-history.ts` — save, list, fetch and delete reports, always
  through the student's own session so RLS applies.
- `/history` — list with average, best and latest scores.
- `/history/[id]` — the full saved report, with delete.
- If saving fails, the student still sees their report, with a note
  suggesting they print or save it as a PDF.

## Units and payments (Paystack)

Every new account gets **5 free units**; marking one essay uses 1 unit. Units
are reserved before the AI call and refunded automatically if marking fails.
Balances live in `public.profiles` and only the server (service role) can
change them.

Students buy **50 units for ₦2,000** through Paystack:

1. **Buy units** (header, marking page, My essays, locked Learn page) calls
   `startCheckout`, which records a pending row in `public.payments` and sends
   the student to Paystack's checkout. The amount is fixed on the server.
2. Paystack calls **`POST /api/paystack/webhook`** on success. The
   `x-paystack-signature` HMAC-SHA512 is verified, then `complete_payment()`
   credits the units, activates the account and logs any referral commission.
3. The student returns to **`/billing/callback`**, which also verifies the
   transaction with Paystack's API, so units appear even if the webhook is late
   or can't reach the server (e.g. on localhost).

`complete_payment()` is idempotent (only a `pending` payment with the exact
amount can complete), so webhook retries and the return page can't double-credit.

**Setup:** set `PAYSTACK_SECRET_KEY`, and in Paystack set the webhook URL to
`https://<your-domain>/api/paystack/webhook`. To test webhooks locally, expose
the dev server with a tunnel (e.g. ngrok) and use that URL with test keys.

**Learn** is open to students with units left or a paid account; others see a
locked page with the Buy units modal.

## Partner programme (referrals)

Partners are approved manually — there is no application form. Only accounts
with `profiles.is_partner = true` see **Earn** (`/partners`) in the navigation
and account menu; anyone else who opens `/partners` is sent back to `/`.

**Admin: approving a partner** (no SQL needed):

1. Supabase dashboard → **Table Editor** → `profiles`.
2. Find the person by the `email` column (use **Filter** → `email` contains …).
3. Tick `is_partner` and click **Save**. Untick it to remove a partner (their
   Earn page disappears and new purchases stop earning commission).

Partners share the link with their automatic code (e.g. `K7MPQ2XR`).
Optionally, type a custom `referral_code` in the same row (4–20 uppercase
letters/digits, unique), e.g. `LAGOSPREP`.

- Every account gets an 8-character referral code (`profiles.referral_code`);
  a partner can be given a custom one as above. Partners share
  `https://<site>/sign-up?ref=CODE` from **Earn**.
- The proxy stores `?ref=` in an HTTP-only cookie (`em_ref`, 30 days, first
  partner wins). At sign-up the code is passed to Supabase and the
  `handle_new_user` trigger records `referred_by`.
- Each successful purchase by a referred student logs a **10% commission
  (₦200)** in `public.affiliate_commissions`, on every purchase — but only if
  the referrer has `is_partner = true` at the time of the purchase.
- Partners request a payout of their whole available balance (minimum ₦1,000,
  one at a time). The amount is calculated in the database.

**Payout emails (Brevo):** when a partner requests a payout, an email with
the amount, bank details and the `mark_payout_paid` command goes to
`PAYOUT_NOTIFY_EMAIL`. Set `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` (a sender
verified in Brevo → Senders, Domains & Dedicated IPs). If they aren't set, the
request still works and the server logs that no email was sent.

**Admin: paying partners** (Supabase SQL Editor):

```sql
-- Waiting payouts
select id, user_id, amount_kobo / 100 as naira, bank_name, account_number, account_name, created_at
from public.payout_requests where status = 'pending' order by created_at;

-- After sending the money
select public.mark_payout_paid('<payout id>');

-- Or decline (the amount returns to the partner's balance)
select public.reject_payout('<payout id>', 'Account details did not match');
```

## Past questions

`/past-questions` shows one PDF paper per exam body and year. Students pick
**WAEC** or **NECO** and a year; the server creates a 5-minute signed URL and
the browser draws the paper with **PDF.js** (`pdfjs-dist`, legacy build for
older phones) onto `<canvas>` elements in
`src/components/past-paper-viewer.tsx`. No `<iframe>`/`<embed>` is used, so it
works the same on Android Chrome and other mobile browsers: pages fit the
screen width, render as they scroll into view, and have + / − zoom (pinch-zoom
also works). There is no toolbar, download or print button, and right-click
is disabled on the viewer.

Papers live in the **private** Storage bucket `past-questions` (created by the
migration; signed-in users can read it). Each paper is a row in
`public.past_questions`: `exam_body` (`WAEC`/`NECO`), `exam_year`,
`file_path`, `is_published`.

**Admin: adding a yearly paper**

1. Supabase dashboard → **Storage** → `past-questions` → **Upload file**, and
   upload the PDF named like `WAEC-2024.pdf`.
2. Add its row (SQL Editor, or Table Editor → `past_questions` → Insert row):

   ```sql
   insert into public.past_questions (exam_body, exam_year, file_path)
   values ('WAEC', 2024, 'WAEC-2024.pdf');
   ```

Set `is_published = false` to hide a paper. There is one row per exam body and
year; to replace a paper, upload the new PDF over the old file.

> View-only is a deterrent, not protection: a determined student can still
> save a PDF their browser has displayed.

## Database migrations

Run each file in `supabase/migrations/` once, in order, in the Supabase SQL
Editor (or `supabase db push`). All are safe to re-run.

## Learn page (video lessons)

`/learn` lists YouTube lessons grouped by topic. Cards open YouTube in a new
tab; nothing is embedded, so the page stays fast and no YouTube scripts load.
The marking report links to the topic for the student's weakest rubric area.

Lessons are configured in `src/lib/learning-videos.ts`. Each entry starts as a
placeholder that links to a YouTube search. To use a real video, replace
`searchQuery` with the video's `url`:

```ts
{ topic: 'letter-writing', url: 'https://www.youtube.com/watch?v=VIDEO_ID' },
```

The title, channel and thumbnail are fetched from YouTube's public oEmbed
endpoint (no API key) and cached for a day. Videos that are deleted or made
private are hidden automatically.

## Project layout

- `src/app/layout.tsx` — shared header (with Mark essay / Learn navigation) and footer.
- `src/app/(app)/page.tsx` — the marking page.
- `src/app/api/evaluate/route.ts` — upload validation and error mapping.
- `src/components/essay-marker.tsx` — submission state and API calls.
- `src/components/essay-form.tsx` — topic field and photo upload, with
  reorder, rotate and remove controls.
- `src/components/use-essay-pages.ts` — page photo state and processing.
- `src/components/evaluation-report.tsx` — the marking report.
- `src/components/marking-scheme.tsx` — rubric and photo tips sidebar.
- `src/lib/prepare-photo.ts` — in-browser photo orientation and compression.
- `src/lib/ai/evaluate-essay.ts` — server-only transcription and marking (xAI
  via the AI SDK, with timeouts and automatic retries).
- `src/app/(app)/learn/page.tsx` — video lessons page.
- `src/lib/learning-videos.ts` — lesson topics and the video list to edit.
- `src/lib/youtube.ts` — YouTube link parsing and cached oEmbed lookups.
- `src/lib/essay-rules.ts` — limits, word-count target, and rubric categories
  shared by the UI and the server.

## Scripts

- `npm run dev` — start the development server.
- `npm run build` — create a production build.
- `npm run lint` — run ESLint.
- `npx tsc --noEmit` — type-check the project.

## Evaluation behavior

The evaluator uses the COEM rubric: Content /10, Organisation /10,
Expression /20, and Mechanical Accuracy /10. It calculates the score out of 50
from the four validated category scores and counts words in the transcription
on the server. Essays are assessed against a 400–450 word target; shorter essays receive an
explicit length-penalty assessment, and an unpenalized below-target response is
flagged for review rather than silently changing the rubric score.
