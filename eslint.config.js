// Lint of the library, the example courses, the tests and the scripts.
// typescript-eslint's recommended rules, with the few the codebase relies on
// on purpose relaxed: `Function` is the type of a learner's compiled function,
// and the canvas code assigns in expressions.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '_site/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-cond-assign': ['error', 'except-parens'],
    },
  },
  {
    // the tests and the example courses may reach into loosely typed objects
    files: ['packages/*/test/**', 'courses/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
