'use server';

import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { deleteEvaluation } from '@/lib/essay-history';

export async function deleteReport(formData: FormData) {
  // Server Actions are public endpoints: re-check the session here.
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const id = String(formData.get('id') ?? '');
  await deleteEvaluation(id);
  redirect('/history');
}
