import 'server-only';

import type { EssayEvaluation } from '@/lib/ai/evaluate-essay';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Reads and deletes run with the signed-in student's session, so Supabase Row
// Level Security limits them to that student's own rows. Saving uses the
// server (service role) key: students have no insert permission, so they
// can't add made-up reports straight through the Supabase API.

const TABLE = 'essay_evaluations';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export interface SavedReportSummary {
  id: string;
  topic: string;
  totalScore: number;
  wordCount: number;
  pageCount: number;
  createdAt: string;
}

export interface SavedReport extends SavedReportSummary {
  report: EssayEvaluation;
}

interface SummaryRow {
  id: string;
  topic: string;
  total_score: number;
  word_count: number;
  page_count: number;
  created_at: string;
}

function toSummary(row: SummaryRow): SavedReportSummary {
  return {
    id: row.id,
    topic: row.topic,
    totalScore: row.total_score,
    wordCount: row.word_count,
    pageCount: row.page_count,
    createdAt: row.created_at,
  };
}

/**
 * Saves a marking report for the given user. Only call it with a report the
 * server itself produced, for a user verified with getCurrentUser().
 * Returns the new row's id, or null on failure.
 */
export async function saveEvaluation(
  userId: string,
  topic: string,
  evaluation: EssayEvaluation,
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error('Failed to save essay evaluation: SUPABASE_SECRET_KEY is not set.');
    return null;
  }

  const { rubric } = evaluation;
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      topic: topic.trim().slice(0, 500),
      total_score: evaluation.totalScore,
      content_score: rubric.content.score,
      organisation_score: rubric.organisation.score,
      expression_score: rubric.expression.score,
      mechanical_accuracy_score: rubric.mechanicalAccuracy.score,
      word_count: evaluation.wordCount,
      page_count: evaluation.pageCount,
      report: evaluation,
      model: process.env.XAI_MODEL?.trim() || 'grok-4.3',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save essay evaluation:', error.message);
    return null;
  }
  return data.id as string;
}

/** The signed-in student's reports, newest first. */
export async function listEvaluations(limit = 50): Promise<SavedReportSummary[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, topic, total_score, word_count, page_count, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to list essay evaluations:', error.message);
    throw new Error('Your essays could not be loaded.');
  }
  return (data as SummaryRow[]).map(toSummary);
}

/** One of the signed-in student's reports, or null if it doesn't exist or isn't theirs. */
export async function getEvaluation(id: string): Promise<SavedReport | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, topic, total_score, word_count, page_count, created_at, report')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to load essay evaluation:', error.message);
    throw new Error('This report could not be loaded.');
  }
  if (!data) return null;
  const row = data as SummaryRow & { report: EssayEvaluation };
  return { ...toSummary(row), report: row.report };
}

/** Deletes one of the signed-in student's reports. Returns whether a row was removed. */
export async function deleteEvaluation(id: string): Promise<boolean> {
  if (!UUID_PATTERN.test(id)) return false;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;

  const { data, error } = await supabase.from(TABLE).delete().eq('id', id).select('id');
  if (error) {
    console.error('Failed to delete essay evaluation:', error.message);
    return false;
  }
  return data.length > 0;
}
