import { defineConfig } from 'vite';

// Relative base keeps the built bundle portable for wrapper containers
// (for example a future mini-game packaging step). Browser-only for now.
export default defineConfig({
  // Explicit array: Cloudflare's Workers/Vite auto-setup injects its plugin here.
  plugins: [],
  base: './',
  build: {
    target: 'es2019',
    assetsInlineLimit: 4096,
  },
  server: {
    host: true,
    port: 5173,
  },
});
