import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Canonical host is www (apex 307-redirects to it) — see CLAUDE.md.
// `site` drives absolute URLs in the sitemap, RSS feed, and <link rel=canonical>.
export default defineConfig({
  site: 'https://www.mrfltransactions.com',
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    sitemap({
      // The intake/portal/dashboard/widget apps live in public/ and are
      // private tools, not marketing pages — keep them out of the sitemap.
      filter: (page) =>
        !/\/(intake|portal|dashboard|widget)\//.test(page),
    }),
  ],
});
