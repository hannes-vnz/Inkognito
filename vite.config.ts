import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Grafiken, Sounds und Musik liegen laut Konzept in /assets und werden 1:1 ausgeliefert.
  publicDir: 'assets',
  // Relative Pfade, damit der Build auch in Unterordnern läuft (GitHub Pages, Vorschau-Links).
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
