import { defineConfig } from 'vite';

// Relative base so the built game works on GitHub Pages under any sub-path.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
