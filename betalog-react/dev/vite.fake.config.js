import path from 'path'
import { fileURLToPath } from 'url'
import base from '../vite.config.js'

const here = fileURLToPath(new URL('.', import.meta.url))

// The app with Firebase swapped for the in-memory fakes — see dev/README.md.
export default {
  ...base,
  resolve: {
    ...(base.resolve || {}),
    alias: {
      ...((base.resolve && base.resolve.alias) || {}),
      'firebase/app':       path.resolve(here, 'fake-firebase/app.js'),
      'firebase/auth':      path.resolve(here, 'fake-firebase/auth.js'),
      'firebase/firestore': path.resolve(here, 'fake-firebase/firestore.js'),
    },
  },
}
