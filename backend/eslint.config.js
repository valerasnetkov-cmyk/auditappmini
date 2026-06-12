import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: [
      'node_modules/**',
      '.tmp-smoke/**',
      'scripts/_legacy/**',
      'uploads/**',
      'backups/**',
      'coverage/**',
    ],
  },
  {
    files: ['src/**/*.js', 'scripts/**/*.{js,mjs}', 'tests/**/*.{js,mjs}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        Blob: 'readonly',
        FormData: 'readonly',
        fetch: 'readonly',
        structuredClone: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
]
