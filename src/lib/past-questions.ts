import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const EXAM_BODIES = ['WAEC', 'NECO'] as const;
export type ExamBody = (typeof EXAM_BODIES)[number];

/** Private Supabase Storage bucket holding one PDF per exam body + year. */
export const PAST_QUESTIONS_BUCKET = 'past-questions';

/** Signed links are generated per page view and expire quickly. */
const SIGNED_URL_TTL_SECONDS = 5 * 60;

export interface PastPaper {
  id: string;
  examBody: ExamBody;
  examYear: number;
  filePath: string;
}

interface PastPaperRow {
  id: string;
  exam_body: ExamBody;
  exam_year: number;
  file_path: string;
}

/**
 * Published papers (newest year first), read with the student's session: RLS
 * lets signed-in users read published rows only.
 */
export async function listPastPapers(): Promise<PastPaper[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('past_questions')
    .select('id, exam_body, exam_year, file_path')
    .eq('is_published', true)
    .order('exam_year', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Failed to load past questions:', error.message);
    throw new Error('Past questions could not be loaded.');
  }

  return (data as PastPaperRow[]).map((row) => ({
    id: row.id,
    examBody: row.exam_body,
    examYear: row.exam_year,
    filePath: row.file_path,
  }));
}

/**
 * A short-lived link to view one paper, created with the student's own session
 * (the bucket only lets signed-in users read). Null if it can't be created.
 */
export async function createPaperViewUrl(filePath: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(PAST_QUESTIONS_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.error(`Failed to sign past question "${filePath}":`, error?.message);
    return null;
  }
  return data.signedUrl;
}
