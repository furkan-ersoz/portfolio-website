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

// "Selected" order: items with an `order` number first (1, 2, 3…), then the rest newest first.
const bySelectedOrder = (a: CardItem, b: CardItem) =>
  (a.order ?? Infinity) - (b.order ?? Infinity) || byNewest(a, b);

// Everything marked `featured: true`.
// When you add a new collection (e.g. concerts), add its featured items here:
//   const concerts = (await getCollection('concerts')).filter((e) => e.data.featured).map(concertToCard);
//   return [...projectCards, ...concerts].sort(bySelectedOrder);
export async function getSelectedItems(): Promise<CardItem[]> {
  const projectCards = (await getSortedProjects())
    .filter((entry) => entry.data.featured)
    .map(projectToCard);

  return [...projectCards].sort(bySelectedOrder);
}
