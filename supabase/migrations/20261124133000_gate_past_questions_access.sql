-- Past questions are available to students with units or a paid account.
drop policy if exists "Signed-in users can read published past questions"
  on public.past_questions;
create policy "Signed-in users can read published past questions"
  on public.past_questions for select
  to authenticated
  using (
    is_published
    and exists (
      select 1
        from public.profiles p
       where p.id = (select auth.uid())
         and (p.credits > 0 or p.activated_at is not null)
    )
  );

drop policy if exists "Signed-in users can read past question PDFs"
  on storage.objects;
create policy "Signed-in users can read past question PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'past-questions'
    and exists (
      select 1
        from public.past_questions q
        join public.profiles p on p.id = (select auth.uid())
       where q.file_path = objects.name
         and q.is_published
         and (p.credits > 0 or p.activated_at is not null)
    )
  );
