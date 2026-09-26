import { defineConfig } from 'vitest/config'

// Firestore rules tests. Separate from `npm test` because they need the
// Firestore emulator running: `npm run test:rules` starts it, runs these,
// and stops it. The rules under test are read from firestore.rules.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 60000,
  },
})
