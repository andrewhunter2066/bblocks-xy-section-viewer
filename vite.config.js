import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// `vite build`: library build producing dist/index.js (named export: XYSectionPlugin), with no
// runtime dependencies. Deploy the whole dist/ directory together; any chunk is resolved relative
// to index.js.
//
// `vite` (npm run dev): serves the repo root and opens the harness, which imports the plugin
// straight from src/js/ with live reload.
export default defineConfig({
  server: {
    open: '/harness/',
  },
  build: {
    assetsInlineLimit: Infinity,
    lib: {
      entry: fileURLToPath(new URL('src/js/index.js', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
  },
});
