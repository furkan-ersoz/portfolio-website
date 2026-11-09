// Blog helpers: the list of posts (newest first) and a reading-time estimate.
import type { CollectionEntry } from 'astro:content';
import { getSortedPosts } from './selected';

export type Post = CollectionEntry<'blog'>;

// Newest first. Drafts show while running `npm run dev`, never in the built site.
export const getPosts = getSortedPosts;

// Rough reading time from the post's source (code, tags and imports removed).
export function readingMinutes(post: Post): number {
  const text = (post.body ?? '')
    .replace(/^import .*$/gm, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[|#*_`>-]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatPostDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
