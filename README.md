# Portfolio — Furkan Ersöz

My personal website, built with [Astro](https://astro.build). It's a static site: every page is generated once and published to GitHub Pages automatically whenever I push to `main`.

Live at **https://furkanersoz.com**.

---

## Where things live

| I want to change…                     | Edit this file                                    |
| ------------------------------------- | ------------------------------------------------- |
| A project's text, tags, links, cover  | `src/content/projects/<project>.mdx` (+ its image) |
| The About text (English + Turkish)    | `src/content/about/about.md`                      |
| My photo on the About page            | `src/content/about/photo.png`                     |
| Email, name, social links             | `src/site.config.ts`                              |
| The moving background (sparkles/Hydra)| `src/scripts/background.js` → "SPARKLE SETTINGS" / "EDIT YOUR HYDRA SKETCH HERE" |
| The background sound                  | `src/scripts/music.js` → "SOUND DESIGN"           |
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

1. **Add the cover image** to `src/content/projects/`, e.g. `my-new-project.jpg` (landscape, ideally 16:9 and at least 1600 px wide, jpg/png/webp). On the Projects page and homepage, each project is shown as this picture (in a frame) with the title under it.
2. **Copy an existing `.mdx` file** in the same folder and rename it, e.g. `my-new-project.mdx`. The file name becomes the web address: `/projects/my-new-project`. Use lowercase letters, numbers and dashes only.
3. **Edit the top part (between the `---` lines) and the text below it**, then save, commit and push. The site rebuilds by itself in ~1–2 minutes.

### The fields at the top of a project file

```yaml
---
title: My New Project                 # required
date: 2026-09-01                      # required, YYYY-MM-DD — controls the order (newest first)
dateLabel: '2025 – 2026'              # optional: shown instead of the date
category: Research                    # required: Research, Music, Paper, Game, …
summary: One or two sentences (used in link previews and search results)   # required
cover: ./my-new-project.jpg           # required: the image next to this file
coverAlt: Short description of the image           # optional (for screen readers)
tags: [Deep Learning, PyTorch]        # optional
status: In production                 # optional: shows a badge, e.g. Submitted
links:                                # optional: buttons under the cover
  - { label: Code, url: https://github.com/… }
  - { label: Paper, url: TODO }       # a link set to TODO shows greyed out
featured: true                        # true = also shown in "Selected" on the homepage
order: 4                              # optional: position in "Selected" (1 = first); without it, newest first after the numbered ones
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

Keep the two-space indent under `text: |` and leave an empty line between paragraphs. To change the photo, replace `photo.png` in the same folder (keep the name, or update the `photo:` line). Portrait images (4:5) look best.

## Editing social links

Open `src/site.config.ts` and replace each `'TODO'` with the full URL, e.g. `'https://github.com/furkan-ersoz'`. Links still set to `TODO` are shown greyed out.

## Changing the background

The background is red sparkles on black: moving the mouse pushes them away, and holding the mouse button (or a finger on phones) pulls them into a swirling cloud. Everything is in `src/scripts/background.js`:

- **SPARKLE SETTINGS**: number of sparkles, colours, size, speed, how strongly the mouse pushes and pulls, trail length, and how long each sparkle lives before fading out and a new one appearing elsewhere (`lifetime`). Change a number, save, and the page updates.
- **EDIT YOUR HYDRA SKETCH HERE**: the Hydra code that draws the final image. The sparkles arrive as source `s0`, so `src(s0).out()` shows them as they are; you can add Hydra effects on top, e.g. `src(s0).modulate(noise(2), 0.01).out()`. To use a completely different Hydra sketch from the [Hydra editor](https://hydra.ojack.xyz), paste it there and set `enabled: false` in the sparkle settings. Microphone input (`a.fft`) is turned off.

(The sparkle simulation itself is in `src/scripts/sparkles.js`; you shouldn't need to touch it.)

The background pauses when the tab is hidden, shows a still frame for visitors who prefer reduced motion, and renders at lower resolution on phones.

## The background sound

On computers, a small panel in the bottom-right corner controls an atmospheric background sound, generated live in the browser with the Web Audio API (nothing to download). **Phones and tablets get no sound and no panel** (the sound code isn't even loaded there).

The Volume fader starts at 15%. Browsers only allow sound after a click or key press (moving or scrolling doesn't count, on any website), so it starts with the visitor's first click anywhere on the page; until then the panel shows a small "Click anywhere for sound" hint. Pull the fader to the bottom (Off) to silence it.

| File | What it is |
| --- | --- |
| `src/scripts/music.js` | The sound engine. The **SOUND DESIGN** section holds all the numbers that shape the sound; `SYNTH_NOTE` sets the synth's note. |
| `src/scripts/music-controls.js` | Ranges and default values of the knobs and fader. |
| `src/components/music/` | The panel, knobs and fader. |

**The layers**

1. **Rumble**: very deep noise, always there while the sound is on.
2. **Swell**: dark atmospheric noise that slowly breathes in and out.
3. **Mouse noise**: a quiet noise through a band-pass filter whose frequency follows the mouse left → right.
4. **Synth**: one wide synth sound on a single note (D2). It starts when the mouse starts moving or is pressed and stops when that stops; a single click plays a short sound. The faster the movement and the longer the press, the more aggressive it gets: brighter, more distorted, wider and a bit louder.

**Controls**

- **Tone**: only levels, never pitches or filters. Low = a thin, quiet background; high = heavy rumble, big swell, louder mouse noise and synth.
- **Space**: from close and dry (0%) to a huge reverb with long, dense echoes (100%).
- **Volume** (fader): at the bottom the sound is off.

Knobs: drag up/down (hold Shift for fine steps), scroll, double-click to reset, or use the arrow keys. In narrow browser windows the panel folds into a round ♪ button. A limiter keeps it from ever getting loud. When the fader is at Off, or the tab is hidden, no audio processing runs.

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
  scripts/music.js     ← the background sound
  styles/global.css    ← colours, fonts, layout column
  components/          ← Card, AudioCompare, Header, Footer, …
  layouts/BaseLayout.astro ← shared layout used by every page
  pages/               ← one file per page (/, /projects, /about, …)
public/                ← files copied as-is (audio, video, favicon, CNAME)
```
