// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// ─────────────────────────────────────────────────────────────
// WHERE THE SITE LIVES
// Right now the site is served from
//   https://furkan-ersoz.github.io/portfolio-website/
// Once furkanersoz.com is connected, set USE_CUSTOM_DOMAIN to true.
// (See README → "Switching to furkanersoz.com".)
// ─────────────────────────────────────────────────────────────
const USE_CUSTOM_DOMAIN = true;

export default defineConfig({
  site: USE_CUSTOM_DOMAIN ? 'https://furkanersoz.com' : 'https://furkan-ersoz.github.io',
  base: USE_CUSTOM_DOMAIN ? '/' : '/portfolio-website',
  output: 'static',
  integrations: [mdx()],
  vite: {
    // Dev server only: prepare Strudel up front so the first Play works without a reload.
    optimizeDeps: { include: ['@strudel/web'] },
    build: {
      // Strudel (the music engine) is one ~650 kB file, downloaded only when someone presses Play.
      chunkSizeWarningLimit: 800,
    },
  },
});
