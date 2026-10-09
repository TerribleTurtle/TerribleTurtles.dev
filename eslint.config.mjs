import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['.astro/', '.wrangler/', 'dist/', 'node_modules/'],
  },
  ...eslintPluginAstro.configs.recommended,
  ...eslintPluginAstro.configs['jsx-a11y-strict'],
  {
    files: ['**/*.astro'],
    rules: {
      'astro/no-set-html-directive': 'error',
      'astro/no-unsafe-inline-scripts': 'error',
      'astro/no-unused-css-selector': 'error',
      'astro/no-set-text-directive': 'error',
      'astro/prefer-class-list-directive': 'error',
    },
  },
  {
    // BaseLayout uses set:html strictly for static, serialized JSON-LD schema metadata
    files: ['src/layouts/BaseLayout.astro'],
    rules: {
      'astro/no-set-html-directive': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // TypeScript specific rules
    },
  },
];
