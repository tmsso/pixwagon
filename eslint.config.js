import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.wrangler/**',
      // Generated — the generator is linted instead.
      'apps/web/src/design/tokens.css',
      'design-system/**',
      // Standalone design-tool output — a self-contained prototype script run
      // via a plain <script> tag, not part of the app bundle. Same treatment
      // as design-system/** above.
      'docs/design/surfaces/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        // Leading underscore marks a deliberately unused parameter — the Phase 0
        // stubs are full of them and they are meaningful, not dead code.
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },

  {
    files: ['apps/web/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  {
    files: ['apps/server/**/*.ts'],
    languageOptions: { globals: { ...globals.worker } },
  },

  // Plain-JS build scripts: Node globals, no TypeScript rules.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
);
