-- Security hardening. Safe to run more than once.

-- Past question PDFs: signed-in users may only read files that belong to a
-- published row, so unticking `is_published` really hides a paper (before,
-- anyone signed in could still open it if they knew the file name).
drop policy if exists "Signed-in users can read past question PDFs" on storage.objects;
create policy "Signed-in users can read past question PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'past-questions'
    and exists (
      select 1 from public.past_questions q
       where q.file_path = objects.name
         and q.is_published
    )
  );

-- Marking reports are saved only by the server (service role) after a real
-- marking, so students can't insert made-up scores through the Supabase API.
-- Reading and deleting their own reports is unchanged.
drop policy if exists "Students can save their own reports" on public.essay_evaluations;
revoke insert on public.essay_evaluations from anon, authenticated;
