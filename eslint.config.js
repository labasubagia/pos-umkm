import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import importX from 'eslint-plugin-import-x'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      'import-x': importX,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Warn when code imports from another module's internals instead of its barrel (index.ts).
      // Forces cross-module consumers to go through the public API, not internal files.
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              regex: 'modules/[^/]+/(?!index)[^/]+',
              message:
                'Import from a module barrel (index.ts) instead of internal paths. ' +
                'E.g. use "../catalog" not "../catalog/components/Foo".',
            },
          ],
        },
      ],
    },
  },
])
