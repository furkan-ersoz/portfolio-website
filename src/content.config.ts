// ─────────────────────────────────────────────────────────────
// CONTENT COLLECTIONS
// Describes which fields each kind of content has.
// Each project is one .mdx file in src/content/projects/.
// ─────────────────────────────────────────────────────────────
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const link = z.object({ label: z.string(), url: z.string() });

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      // Optional: show this instead of the date, e.g. "2026" or "2024 – 2026"
      dateLabel: z.string().optional(),
      category: z.string(),
      summary: z.string(),
      cover: image(),
      coverAlt: z.string().optional(),
      tags: z.array(z.string()).default([]),
      status: z.string().optional(),
      links: z.array(link).default([]),
      featured: z.boolean().default(false),
      // Optional: position in the homepage "Selected" list (1 = first). Items without it come after, newest first.
      order: z.number().optional(),
    }),
});

// The About page text (English + Turkish) lives in src/content/about/about.md
const about = defineCollection({
  loader: glob({ pattern: 'about.md', base: './src/content/about' }),
  schema: ({ image }) =>
    z.object({
      photo: image(), // portrait photo (phones)
      photoWide: image().optional(), // landscape photo (computers)
      photoAlt: z.string(),
      en: z.object({ title: z.string(), text: z.string() }),
      tr: z.object({ title: z.string(), text: z.string() }),
    }),
});

// Blog posts: one .md/.mdx file per post in src/content/blog/. The file name is the URL (/blog/<file-name>).
// `draft: true` keeps a post out of the built site (it still shows while running `npm run dev`).
// Like projects, a post can be shown on the homepage with `featured: true` (+ `order`).
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      summary: z.string(), // one line, shown in search results and under the title
      cover: image(),
      coverAlt: z.string().optional(),
      category: z.string().default('Blog'),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
      order: z.number().optional(),
      // Optional series, e.g. series: 'Notes from MPC', part: 2 (shown above the title)
      series: z.string().optional(),
      part: z.number().optional(),
    }),
});

// Music releases: one .mdx file per release in src/content/music/ (same fields as a project).
// They get a page at /music/<file-name>, show on the Listen page and, with `featured: true`, on the homepage.
const music = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/music' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      dateLabel: z.string().optional(),
      category: z.string().default('Music'),
      summary: z.string(),
      cover: image(),
      coverAlt: z.string().optional(),
      tags: z.array(z.string()).default([]),
      status: z.string().optional(),
      links: z.array(link).default([]),
      featured: z.boolean().default(false),
      order: z.number().optional(),
    }),
});

// ─── Adding more collections later (e.g. concerts, posts) ───
// 1. Copy the `projects` block above, rename it (e.g. `concerts`) and point
//    `base` at a new folder (e.g. './src/content/concerts').
// 2. Add it to the export below.
// 3. Register it in src/lib/selected.ts so featured items show on the homepage.

export const collections = { projects, about, blog, music };
