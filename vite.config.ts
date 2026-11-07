import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works under any GitHub Pages repo path.
export default defineConfig({
  base: './',
  plugins: [react()],
  // The whole textbook ships as one JSON module (~1.5 MB, ~440 kB gzip).
  build: { chunkSizeWarningLimit: 2000 },
});
