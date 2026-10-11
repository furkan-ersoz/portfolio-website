# Portfolio — Hanifi Furkan Ersöz

My personal website, built with [Astro](https://astro.build). It's a static site: every page is generated once and published to GitHub Pages automatically whenever I push to `main`.

Live at **https://furkanersoz.com**.

---

## Where things live

| I want to change…                     | Edit this file                                    |
| ------------------------------------- | ------------------------------------------------- |
| A project's text, tags, links, cover  | `src/content/projects/<project>.mdx` (+ its image) |
| The About text (English + Turkish)    | `src/content/about/about.md`                      |
| My photo on the About page            | `src/content/about/photo.jpg`                     |
| Email, name, subtitle, social links   | `src/site.config.ts`                              |
| The moving Hydra background           | `src/scripts/background.js` → "EDIT YOUR HYDRA SKETCH HERE" |
| Colours, fonts, column width          | `src/styles/global.css` (top of the file)         |
| Audio / video files                   | `public/audio/…`, `public/video/…`                |

You never need to touch the files in `src/pages`, `src/components` or `src/layouts` for day-to-day changes.

---

## Running the site on my computer

You need [Node.js](https://nodejs.org) 22 or newer. Then, in this folder:

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:4321/ — the page updates live as you save files. Press `Ctrl + C` in the terminal to stop it.

Before pushing, you can check that everything builds:

```bash
npm run build
```

---

## Adding a new project (3 steps)

1. **Add the cover image** to `src/content/projects/`, e.g. `my-new-project.jpg` (landscape, about 1600×1000 px, jpg/png/webp).
2. **Copy an existing `.mdx` file** in the same folder and rename it, e.g. `my-new-project.mdx`. The file name becomes the web address: `/projects/my-new-project`. Use lowercase letters, numbers and dashes only.
3. **Edit the top part (between the `---` lines) and the text below it**, then save, commit and push. The site rebuilds by itself in ~1–2 minutes.

### The fields at the top of a project file

```yaml
---
title: My New Project                 # required
date: 2026-09-01                      # required, YYYY-MM-DD — controls the order (newest first)
dateLabel: '2025 – 2026'              # optional: shown instead of the date
category: Research                    # required: Research, Music, Paper, Game, …
summary: One or two sentences shown on the card.   # required
cover: ./my-new-project.jpg           # required: the image next to this file
coverAlt: Short description of the image           # optional (for screen readers)
tags: [Deep Learning, PyTorch]        # optional
status: In production                 # optional: shows a badge, e.g. Submitted
links:                                # optional: buttons under the cover
  - { label: Code, url: https://github.com/… }
  - { label: Paper, url: TODO }       # a link set to TODO shows greyed out
featured: true                        # true = also shown in "Selected" on the homepage
---
```

> Tip: in YAML, if a value contains a colon (`:`), put it in quotes: `title: 'Part 1: The Beginning'`.

### Writing the page body

The body is MDX, which is Markdown with a few extra building blocks:

```mdx
## A heading

A paragraph with **bold**, *italic* and a [link](https://example.com).

- a list item
- another one

![Description of the image](./my-diagram.png)
<p class="caption">A caption under the image.</p>

<Audio src="/audio/my-song.mp3" title="My song" />

<AudioCompare
  title="Example 1"
  target="/audio/synth/example-1-target.wav"
  reconstructed="/audio/synth/example-1-reconstructed.wav"
/>

<Video src="/video/demo.mp4" caption="Plugin demo" />

<YouTube id="VIDEO_ID" title="Demo video" />
```

- **Images** inside the body go next to the `.mdx` file and are referenced with `./`.
- **Audio and video** files go in `public/` and are referenced from `/` (e.g. `public/audio/x.mp3` → `/audio/x.mp3`).
- `AudioCompare` also accepts `targetLabel="…"` and `reconstructedLabel="…"` to rename the two players.
- Notes for yourself that shouldn't appear on the site: `{/* like this */}`.

---

## Editing the About page

Open `src/content/about/about.md`. It contains both languages:

```yaml
en:
  title: About
  text: |
    First paragraph…

    Second paragraph…
tr:
  title: Hakkımda
  text: |
    İlk paragraf…
```

Keep the two-space indent under `text: |` and leave an empty line between paragraphs. To change the photo, replace `photo.jpg` in the same folder (keep the name, or update the `photo:` line). Portrait images (4:5) look best.

## Editing social links

Open `src/site.config.ts` and replace each `'TODO'` with the full URL, e.g. `'https://github.com/furkan-ersoz'`. Links still set to `TODO` are shown greyed out.

## Changing the Hydra background

Open `src/scripts/background.js` and paste your sketch from the [Hydra editor](https://hydra.ojack.xyz) inside the `sketch()` function, in the block marked **EDIT YOUR HYDRA SKETCH HERE**. Same syntax as the editor (`osc()`, `noise()`, `mouse.x`, `time`…). Microphone input (`a.fft`) is turned off, so don't use `a.` in the background sketch.

The background pauses when the tab is hidden, shows a still frame for visitors who prefer reduced motion, and renders at lower resolution on phones.

## Adding other kinds of content later (concerts, posts…)

1. Create a folder, e.g. `src/content/concerts/`, with `.mdx` files.
2. In `src/content.config.ts`, copy the `projects` block, rename it `concerts`, point `base` to the new folder and add it to the `collections` export (instructions are in the file).
3. In `src/lib/selected.ts`, add the featured concerts to `getSelectedItems()` (example in the comment). They'll appear in the homepage "Selected" list, mixed with projects by date, using the same cards.
4. Replace `src/pages/concerts.astro` with a list page (copy `src/pages/projects/index.astro` as a start).

---

## Deployment (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` builds and publishes the site on every push to `main`.

**One-time setup:**

1. On GitHub, open the repository → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or re-run the workflow from the **Actions** tab).

### Custom domain furkanersoz.com (already set up — kept here for reference)

1. **At the domain registrar**, add these DNS records:

   | Type  | Name / Host | Value                    |
   | ----- | ----------- | ------------------------ |
   | A     | `@`         | `185.199.108.153`        |
   | A     | `@`         | `185.199.109.153`        |
   | A     | `@`         | `185.199.110.153`        |
   | A     | `@`         | `185.199.111.153`        |
   | AAAA  | `@`         | `2606:50c0:8000::153`    |
   | AAAA  | `@`         | `2606:50c0:8001::153`    |
   | AAAA  | `@`         | `2606:50c0:8002::153`    |
   | AAAA  | `@`         | `2606:50c0:8003::153`    |
   | CNAME | `www`       | `furkan-ersoz.github.io` |

   (The AAAA records are optional, for IPv6.) Remove any other A/AAAA/CNAME records for `@` and `www` that the registrar added by default.
2. In `astro.config.mjs`, change `const USE_CUSTOM_DOMAIN = false;` to `true`, then commit and push.
3. On GitHub → **Settings** → **Pages** → **Custom domain**, enter `furkanersoz.com` and save. When the DNS check passes (can take up to 24 h), tick **Enforce HTTPS**.

`public/CNAME` already contains `furkanersoz.com`. With GitHub Actions deployments GitHub ignores that file (the Settings field is what counts), so it doesn't affect the current github.io address.

---

## Project structure

```
src/
  content/
    projects/          ← one .mdx file + one cover image per project
    about/about.md     ← About text (EN + TR) and photo
  content.config.ts    ← which fields each content type has
  site.config.ts       ← name, email, navigation, social links
  scripts/background.js← the Hydra sketch
  styles/global.css    ← colours, fonts, layout column
  components/          ← Card, AudioCompare, Header, Footer, …
  layouts/BaseLayout.astro ← shared layout used by every page
  pages/               ← one file per page (/, /projects, /about, …)
public/                ← files copied as-is (audio, video, favicon, CNAME)
```
