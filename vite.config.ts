import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      input: {
        popup: 'popup.html',
        background: 'src/background.ts',
      },
      output: {
        entryFileNames: 'assets/[name].js',
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
