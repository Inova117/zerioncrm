import { defineConfig } from 'vitest/config';

// Vitest cubre SOLO la app (src/). ZerionScraperAI tiene sus propios tests con
// el runner de Node (node:test) — no mezclar runners en una misma corrida.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
