// Curated YouTube lessons shown on the /learn page.
//
// HOW TO ADD A REAL VIDEO
// Replace a placeholder's `searchQuery` with `url`, the video's YouTube link:
//
//   { topic: 'letter-writing', url: 'https://www.youtube.com/watch?v=VIDEO_ID' },
//
// The title, channel and thumbnail are fetched from YouTube automatically.
// You may still set `title` or `description` to override what is shown.
// Videos that are deleted or made private disappear from the page by themselves.
//
// Placeholders (entries with `searchQuery` and no `url`) link to a YouTube
// search for that lesson, so every card works until a real video is chosen.

import type { RubricCategoryKey } from '@/lib/essay-rules';

export const LEARNING_TOPICS = [
  {
    id: 'essay-basics',
    label: 'Planning & structure',
    description: 'Understand the question, plan your points and build clear paragraphs.',
  },
  {
    id: 'letter-writing',
    label: 'Letter writing',
    description: 'Formal, informal and semi-formal letters: format, tone and content.',
  },
  {
    id: 'argumentative',
    label: 'Argumentative & debate',
    description: 'Take a side, support it with reasons and handle the other view.',
  },
  {
    id: 'narrative-descriptive',
    label: 'Narrative & descriptive',
    description: 'Tell a story or paint a picture with vivid, well-ordered detail.',
  },
  {
    id: 'speech-article',
    label: 'Speeches & articles',
    description: 'Address an audience, format articles and keep the right register.',
  },
  {
    id: 'vocabulary-expression',
    label: 'Vocabulary & expression',
    description: 'Choose precise words, vary your sentences and avoid slang.',
  },
  {
    id: 'grammar-mechanics',
    label: 'Grammar & mechanics',
    description: 'Concord, tenses, punctuation and spelling that examiners check.',
  },
] as const;

export type LearningTopicId = (typeof LEARNING_TOPICS)[number]['id'];

/** Where to send a student who scored lowest in each rubric category. */
export const TOPIC_FOR_RUBRIC_CATEGORY: Record<RubricCategoryKey, LearningTopicId> = {
  content: 'essay-basics',
  organisation: 'essay-basics',
  expression: 'vocabulary-expression',
  mechanicalAccuracy: 'grammar-mechanics',
};

export type LearningVideoEntry = {
  topic: LearningTopicId;
  title?: string;
  description?: string;
} & ({ url: string; searchQuery?: never } | { searchQuery: string; title: string; url?: never });

export const LEARNING_VIDEOS: LearningVideoEntry[] = [
  // Planning & structure
  {
    topic: 'essay-basics',
    title: 'How to understand an essay question',
    description: 'Find the type of essay, the audience and what you are asked to do.',
    searchQuery: 'WAEC English essay how to interpret the question',
  },
  {
    topic: 'essay-basics',
    title: 'Planning an essay in 5 minutes',
    description: 'Turn the question into an outline before you start writing.',
    searchQuery: 'how to plan an essay WAEC NECO English continuous writing',
  },

  // Letter writing
  {
    topic: 'letter-writing',
    title: 'Informal letters: format and tone',
    description: 'Address, date, salutation and a friendly but correct tone.',
    searchQuery: 'WAEC informal letter writing format',
  },
  {
    topic: 'letter-writing',
    title: 'Formal letters: format and tone',
    description: 'Two addresses, heading, formal language and subscription.',
    searchQuery: 'WAEC formal letter writing format',
  },
  {
    topic: 'letter-writing',
    title: 'Semi-formal letters explained',
    description: 'When to use them and how they differ from the others.',
    searchQuery: 'WAEC semi formal letter writing',
  },

  // Argumentative & debate
  {
    topic: 'argumentative',
    title: 'Writing an argumentative essay',
    description: 'State your position and defend it point by point.',
    searchQuery: 'WAEC argumentative essay writing',
  },
  {
    topic: 'argumentative',
    title: 'How to write a debate',
    description: 'Greetings, motion, points and a strong close.',
    searchQuery: 'WAEC debate writing format',
  },

  // Narrative & descriptive
  {
    topic: 'narrative-descriptive',
    title: 'Narrative essays that hold attention',
    description: 'Plot, sequence and a memorable ending.',
    searchQuery: 'WAEC narrative essay writing',
  },
  {
    topic: 'narrative-descriptive',
    title: 'Descriptive essays with vivid detail',
    description: 'Use the senses and organise description clearly.',
    searchQuery: 'WAEC descriptive essay writing',
  },

  // Speeches & articles
  {
    topic: 'speech-article',
    title: 'How to write a speech',
    description: 'Addressing the audience, body and closing remarks.',
    searchQuery: 'WAEC speech writing format',
  },
  {
    topic: 'speech-article',
    title: 'Writing an article for a newspaper or magazine',
    description: 'Headline, byline and an engaging introduction.',
    searchQuery: 'WAEC article writing format',
  },

  // Vocabulary & expression
  {
    topic: 'vocabulary-expression',
    title: 'Improve your vocabulary for essays',
    description: 'Precise word choice without sounding forced.',
    searchQuery: 'improve vocabulary for English essay writing WAEC',
  },
  {
    topic: 'vocabulary-expression',
    title: 'Varying your sentences',
    description: 'Mix sentence lengths and openings to improve expression.',
    searchQuery: 'sentence variety essay writing tips',
  },

  // Grammar & mechanics
  {
    topic: 'grammar-mechanics',
    title: 'Concord (subject–verb agreement)',
    description: 'The rule behind one of the most common essay errors.',
    searchQuery: 'concord subject verb agreement WAEC English',
  },
  {
    topic: 'grammar-mechanics',
    title: 'Punctuation that examiners check',
    description: 'Commas, full stops, apostrophes and capital letters.',
    searchQuery: 'punctuation rules English essay WAEC',
  },
];
