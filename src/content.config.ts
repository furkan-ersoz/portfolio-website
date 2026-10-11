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
    }),
});

// The About page text (English + Turkish) lives in src/content/about/about.md
const about = defineCollection({
  loader: glob({ pattern: 'about.md', base: './src/content/about' }),
  schema: ({ image }) =>
    z.object({
      photo: image(),
      photoAlt: z.string(),
      en: z.object({ title: z.string(), text: z.string() }),
      tr: z.object({ title: z.string(), text: z.string() }),
    }),
});

// ─── Adding more collections later (e.g. concerts, posts) ───
// 1. Copy the `projects` block above, rename it (e.g. `concerts`) and point
//    `base` at a new folder (e.g. './src/content/concerts').
// 2. Add it to the export below.
// 3. Register it in src/lib/selected.ts so featured items show on the homepage.

export const collections = { projects, about };
