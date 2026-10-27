import { defineConfig } from 'vitest/config';

// The library's unit tests. The example courses are checked by `npm run check`
// and `npm run tune`, not here: the library's tests never depend on them.
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    environment: 'node',
  },
});
