import { defineConfig } from 'vite';

// GitHub Pages repository name is 'ram-hunter' (https://<username>.github.io/ram-hunter/)
// When GITHUB_PAGES or GITHUB_ACTIONS is active, base defaults to '/ram-hunter/'.
// Can be overridden via BASE_PATH environment variable (e.g. BASE_PATH='/').
// Defaults to './' for standalone / local deployments.
const base = process.env.BASE_PATH ?? (process.env.GITHUB_PAGES || process.env.GITHUB_ACTIONS ? '/ram-hunter/' : './');

export default defineConfig({
  base,
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: { output: { inlineDynamicImports: true } },
    chunkSizeWarningLimit: 1600
  }
});
