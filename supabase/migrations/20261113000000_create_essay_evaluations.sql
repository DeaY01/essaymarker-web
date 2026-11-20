-- Marking reports, one row per marked essay, owned by the student who submitted it.

create table if not exists public.essay_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic text not null default '' check (char_length(topic) <= 500),

  -- Scores are stored as columns for listing and sorting; the full report is in `report`.
  total_score smallint not null check (total_score between 0 and 50),
  content_score smallint not null check (content_score between 0 and 10),
  organisation_score smallint not null check (organisation_score between 0 and 10),
  expression_score smallint not null check (expression_score between 0 and 20),
  mechanical_accuracy_score smallint not null check (mechanical_accuracy_score between 0 and 10),
  word_count integer not null check (word_count >= 0),
  page_count smallint not null check (page_count between 0 and 5),

  -- The complete EssayEvaluation JSON returned by the marker (feedback,
  -- corrections, advice, transcription, submission notes).
  report jsonb not null,
  model text not null default '',

  created_at timestamptz not null default now()
);

create index if not exists essay_evaluations_user_created_idx
  on public.essay_evaluations (user_id, created_at desc);

-- Row Level Security: a student can only see, add and delete their own reports.
-- Reports are never edited after marking, so there is no update policy.
alter table public.essay_evaluations enable row level security;

drop policy if exists "Students can read their own reports" on public.essay_evaluations;
create policy "Students can read their own reports"
  on public.essay_evaluations for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Students can save their own reports" on public.essay_evaluations;
create policy "Students can save their own reports"
  on public.essay_evaluations for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Students can delete their own reports" on public.essay_evaluations;
create policy "Students can delete their own reports"
  on public.essay_evaluations for delete
  to authenticated
  using ((select auth.uid()) = user_id);
