// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://www.vixalien.com",
  integrations: [sitemap()],

  redirects: {
      "/posts": "/",
      "/feed": "/rss.xml",
	},

  vite: {
    plugins: [tailwindcss()],
  },
});