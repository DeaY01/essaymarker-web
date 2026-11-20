import 'server-only';

import { cacheLife } from 'next/cache';
import { z } from 'zod';

import {
  LEARNING_VIDEOS,
  type LearningTopicId,
  type LearningVideoEntry,
} from '@/lib/learning-videos';

const VIDEO_ID_PATTERN = /^[\w-]{11}$/u;

/** Extracts the 11-character video ID from the common YouTube link formats. */
export function parseYouTubeVideoId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.|music\.)/u, '');
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const [, kind, value] = url.pathname.split('/');
      if (kind === 'shorts' || kind === 'embed' || kind === 'live' || kind === 'v') id = value;
    }
  }

  return id && VIDEO_ID_PATTERN.test(id) ? id : null;
}

const oEmbedSchema = z.object({
  title: z.string(),
  author_name: z.string().optional(),
});

type VideoDetails = { title: string; channel?: string } | 'unavailable' | null;

/**
 * Looks up a video's public title and channel through YouTube's oEmbed
 * endpoint (no API key needed). Cached for a day.
 * Returns 'unavailable' for deleted or private videos, and null when YouTube
 * could not be reached, so the caller can fall back to the configured title.
 */
async function getVideoDetails(videoId: string): Promise<VideoDetails> {
  'use cache';
  cacheLife('days');

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
      return 'unavailable';
    }
    if (!response.ok) return null;
    const parsed = oEmbedSchema.safeParse(await response.json());
    return parsed.success
      ? { title: parsed.data.title, channel: parsed.data.author_name }
      : null;
  } catch {
    return null;
  }
}

export interface LearningCard {
  key: string;
  topic: LearningTopicId;
  kind: 'video' | 'search';
  title: string;
  description?: string;
  channel?: string;
  href: string;
  thumbnailUrl?: string;
}

async function toCard(entry: LearningVideoEntry, index: number): Promise<LearningCard | null> {
  if (entry.url === undefined) {
    return {
      key: `search-${index}`,
      topic: entry.topic,
      kind: 'search',
      title: entry.title,
      description: entry.description,
      href: `https://www.youtube.com/results?search_query=${encodeURIComponent(entry.searchQuery)}`,
    };
  }

  const videoId = parseYouTubeVideoId(entry.url);
  if (!videoId) {
    console.warn(`Skipping learning video with an unrecognised YouTube link: ${entry.url}`);
    return null;
  }

  const details = await getVideoDetails(videoId);
  if (details === 'unavailable') return null;

  return {
    key: `video-${videoId}`,
    topic: entry.topic,
    kind: 'video',
    title: entry.title ?? details?.title ?? 'Watch on YouTube',
    description: entry.description,
    channel: details?.channel,
    href: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

/** Resolves the configured lessons into display cards, dropping unavailable videos. */
export async function getLearningCards(): Promise<LearningCard[]> {
  const cards = await Promise.all(LEARNING_VIDEOS.map(toCard));
  return cards.filter((card): card is LearningCard => card !== null);
}
