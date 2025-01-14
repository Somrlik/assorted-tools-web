import { defineConfig } from 'astro/config';
import fs from 'node:fs';

import react from "@astrojs/react";

const keyCert = {
  pfx: fs.readFileSync(process.env.HTTPS_PFX_FILE),
};

// https://astro.build/config
export default defineConfig({
  integrations: [react({
    include: ['**/react/*'],
    // experimentalReactChildren: true,
  })],
  vite: {
    server: {
      https: keyCert,
    },
  },
});
