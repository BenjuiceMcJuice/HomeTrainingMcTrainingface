import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Build config runs in Node, not the browser, so `process` is legitimate
    // there and nowhere else.
    files: ['vite.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Vite replaces these at build time via `define`; they exist in the bundle
    // and nowhere else.
    files: ['src/lib/buildInfo.js'],
    languageOptions: {
      globals: { __BUILD_SHA__: 'readonly', __BUILD_TIME__: 'readonly' },
    },
  },
])
