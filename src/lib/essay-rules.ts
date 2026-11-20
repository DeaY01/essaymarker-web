// Shared, client-safe constants and helpers for essay submission and marking.
// Keep this module free of server-only imports so both the UI and the
// evaluation service use the same limits and word-count logic.

export const TOPIC_MAX_LENGTH = 500;

// Handwritten submissions: one photo per page.
export const MAX_PAGES = 5;
/** Per-page limit enforced by the server. The browser compresses well below this. */
export const MAX_PAGE_BYTES = 4 * 1024 * 1024;
/** Formats the server accepts. The browser converts every photo to JPEG first. */
export const ACCEPTED_PAGE_TYPES = ['image/jpeg', 'image/png'] as const;

export const TARGET_MIN_WORDS = 400;
export const TARGET_MAX_WORDS = 450;

export const MAXIMUM_SCORE = 50;

export const RUBRIC_CATEGORIES = [
  {
    key: 'content',
    label: 'Content',
    maximum: 10,
    description: 'Relevance to the topic and depth of ideas.',
  },
  {
    key: 'organisation',
    label: 'Organisation',
    maximum: 10,
    description: 'Format, paragraphing and logical flow.',
  },
  {
    key: 'expression',
    label: 'Expression',
    maximum: 20,
    description: 'Vocabulary, sentence variety and tone.',
  },
  {
    key: 'mechanicalAccuracy',
    label: 'Mechanical accuracy',
    maximum: 10,
    description: 'Grammar, spelling and punctuation.',
  },
] as const;

export type RubricCategoryKey = (typeof RUBRIC_CATEGORIES)[number]['key'];

export type PerformanceTone = 'strong' | 'good' | 'fair' | 'weak';

/** Plain-language band for a score; used for labels and colour only. */
export function getPerformanceBand(
  score: number,
  maximum: number,
): { label: string; tone: PerformanceTone } {
  const ratio = maximum > 0 ? score / maximum : 0;
  if (ratio >= 0.8) return { label: 'Excellent', tone: 'strong' };
  if (ratio >= 0.6) return { label: 'Good', tone: 'good' };
  if (ratio >= 0.45) return { label: 'Fair', tone: 'fair' };
  return { label: 'Needs work', tone: 'weak' };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}
