import { defineConfig } from 'astro/config';

// BASE_PATH is "/cori" on <user>.github.io/cori and "/" once a custom domain is set.
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  base: process.env.BASE_PATH || '/',
});
