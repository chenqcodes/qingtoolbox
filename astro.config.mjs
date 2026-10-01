import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tools.cqzzz.top',
  trailingSlash: 'always',
  integrations: [sitemap({
    filter: (page) => !['/tools/building-sunlight/', '/404/', '/404.html'].includes(new URL(page).pathname),
  })],
});
