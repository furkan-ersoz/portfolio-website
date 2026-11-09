// Turns entries from any collection into the same "card" shape,
// so the homepage can mix projects, concerts, posts… in one list.
import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { withBase } from './url';

export interface CardItem {
  title: string;
  href: string;
  date: Date;
  dateLabel?: string;
  category: string;
  summary: string;
  cover: ImageMetadata;
  coverAlt: string;
  tags: string[];
  status?: string;
  order?: number;
}

const byNewest = (a: { date: Date }, b: { date: Date }) => b.date.getTime() - a.date.getTime();
const isDraft = (data: { draft?: boolean }) => !import.meta.env.DEV && data.draft === true;

export async function getSortedProjects(): Promise<CollectionEntry<'projects'>[]> {
  const projects = await getCollection('projects');
  return projects.sort((a, b) => byNewest(a.data, b.data));
}

export function projectToCard(entry: CollectionEntry<'projects'>): CardItem {
  const d = entry.data;
  return {
    title: d.title,
    href: withBase(`/projects/${entry.id}`),
    date: d.date,
    dateLabel: d.dateLabel,
    category: d.category,
    summary: d.summary,
    cover: d.cover,
    coverAlt: d.coverAlt ?? `Cover image for ${d.title}`,
    tags: d.tags,
    status: d.status,
    order: d.order,
  };
}

export async function getSortedPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog', (p) => !isDraft(p.data));
  // newest first; posts of a series on the same day: later part first
  return posts.sort((a, b) => byNewest(a.data, b.data) || (b.data.part ?? 0) - (a.data.part ?? 0));
}

export async function getSortedMusic(): Promise<CollectionEntry<'music'>[]> {
  const music = await getCollection('music');
  return music.sort((a, b) => byNewest(a.data, b.data));
}

export function postToCard(entry: CollectionEntry<'blog'>): CardItem {
  const d = entry.data;
  return {
    title: d.title,
    href: withBase(`/blog/${entry.id}`),
    date: d.date,
    category: d.category,
    summary: d.summary,
    cover: d.cover,
    coverAlt: d.coverAlt ?? `Cover image for ${d.title}`,
    tags: d.tags,
    order: d.order,
  };
}

export function musicToCard(entry: CollectionEntry<'music'>): CardItem {
  const d = entry.data;
  return {
    title: d.title,
    href: withBase(`/music/${entry.id}`),
    date: d.date,
    dateLabel: d.dateLabel,
    category: d.category,
    summary: d.summary,
    cover: d.cover,
    coverAlt: d.coverAlt ?? `Cover image for ${d.title}`,
    tags: d.tags,
    status: d.status,
    order: d.order,
  };
}

// "Selected" order: items with an `order` number first (1, 2, 3…), then the rest newest first.
const bySelectedOrder = (a: CardItem, b: CardItem) =>
  (a.order ?? Infinity) - (b.order ?? Infinity) || byNewest(a, b);

// Everything marked `featured: true`: projects, blog posts and music, as one list of cards.
// To add another collection later, map its featured entries to cards and add them here.
export async function getSelectedItems(): Promise<CardItem[]> {
  const featured = <T extends { data: { featured: boolean } }>(list: T[]) => list.filter((e) => e.data.featured);
  return [
    ...featured(await getSortedProjects()).map(projectToCard),
    ...featured(await getSortedPosts()).map(postToCard),
    ...featured(await getSortedMusic()).map(musicToCard),
  ].sort(bySelectedOrder);
}
