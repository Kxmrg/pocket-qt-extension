import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
  },
});
