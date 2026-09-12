import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Which build is this? Cloudflare Pages exposes the commit it built from as
// CF_PAGES_COMMIT_SHA, but it has no VITE_ prefix so Vite will not expose it to
// the app on its own -- it has to be injected here (BTL-B14).
//
// This mattered on 4 September: with the service worker serving assets
// cache-first there was no way to tell whether a phone had picked up a new
// bundle, and the answer had to be inferred from Apple rejecting a push signed
// with a rotated key. The cache name has been bumped four times since.
const BUILD_SHA  = process.env.CF_PAGES_COMMIT_SHA || null
const BUILD_TIME = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_SHA__:  JSON.stringify(BUILD_SHA),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
  },
})
