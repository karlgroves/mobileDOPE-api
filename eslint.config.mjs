// Flat ESLint config for the Mobile DOPE API (Node/Express/TypeScript, CommonJS).
//
// Migrated from the legacy `.eslintrc.js`. This is a BACKEND project, so all
// React / JSX-a11y plugins from the standardization issues are intentionally
// omitted. Adoption is "pragmatic" (see docs/adr/0004): the full backend plugin
// set is enabled, but noisy/subjective rules are set to `warn` so the gate is
// green today and can be tightened to `error` in follow-ups.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import importX from 'eslint-plugin-import-x';
import promise from 'eslint-plugin-promise';
import n from 'eslint-plugin-n';
import jsdoc from 'eslint-plugin-jsdoc';
import noSecrets from 'eslint-plugin-no-secrets';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      'reports/**',
      'public/**',
      // Config files are not application code and are not part of tsconfig's
      // type-checking program; skip them to avoid type-aware lint errors.
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      security,
      sonarjs,
      unicorn,
      'import-x': importX,
      promise,
      n,
      jsdoc,
      'no-secrets': noSecrets,
    },
    settings: {
      jsdoc: { mode: 'typescript' },
    },
    rules: {
      // --- TypeScript (errors: safe / clearly correct) ---
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      // Kept at `warn` to avoid large/behaviour-sensitive churn on existing code
      // (see ADR-0004). `||` -> `??` in particular can change runtime behaviour
      // for falsy values (0, ''), so it is surfaced rather than enforced for now.
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unnecessary-type-conversion': 'warn',
      '@typescript-eslint/no-invalid-void-type': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Naming convention (issue #3). `warn` because it is rarely auto-fixable
      // and the existing Sequelize models use mixed casing.
      '@typescript-eslint/naming-convention': [
        'warn',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        // Destructured names mirror request-body / DB-row keys, which this API
        // intentionally keeps in snake_case (the SQL schema uses snake_case).
        { selector: 'variable', modifiers: ['destructured'], format: null },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        // Allow object literal / property names from external/DB shapes. The
        // API's data contract (DB columns, request/response bodies, Sequelize
        // model fields) is snake_case end to end, so property-like identifiers
        // are exempted from the camelCase requirement.
        { selector: 'objectLiteralProperty', format: null },
        { selector: 'typeProperty', format: null },
        { selector: 'classProperty', format: null },
      ],

      // --- General (errors) ---
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // --- Security (clearly-correct => error; heuristic/noisy => warn) ---
      'security/detect-non-literal-regexp': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-child-process': 'warn',
      'security/detect-possible-timing-attacks': 'warn',

      // --- Promise correctness ---
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/catch-or-return': 'error',
      'promise/no-nesting': 'warn',

      // --- Node ---
      'n/no-deprecated-api': 'error',
      'n/no-process-exit': 'warn',
      'n/prefer-promises/fs': 'warn',

      // --- Imports (resolution is handled by TypeScript itself) ---
      'import-x/no-unresolved': 'off',
      'import-x/no-self-import': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // --- Code quality (noisy/subjective => warn) ---
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 4 }],
      'sonarjs/no-identical-functions': 'warn',
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 75, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', { max: 10 }],
      'max-depth': ['warn', 4],

      // --- Unicorn (modern JS, but disable the most opinionated rules) ---
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/filename-case': [
        'warn',
        { cases: { kebabCase: true, pascalCase: true, camelCase: true } },
      ],

      // --- JSDoc / TSDoc (documentation; warn so it does not block) ---
      'jsdoc/require-jsdoc': [
        'warn',
        {
          // Do NOT auto-insert empty `/** */` stubs (lint-staged runs --fix).
          // The rule surfaces missing docs as warnings; authors write real ones.
          enableFixer: false,
          contexts: [
            'ExportNamedDeclaration > FunctionDeclaration',
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
          ],
          checkConstructors: false,
        },
      ],
      'jsdoc/require-description': 'warn',
      'jsdoc/no-undefined-types': 'off',
      // `route` and `access` are this project's route-documentation tags.
      'jsdoc/check-tag-names': [
        'warn',
        { definedTags: ['remarks', 'public', 'internal', 'beta', 'route', 'access'] },
      ],

      // --- Secrets ---
      'no-secrets/no-secrets': [
        'error',
        { tolerance: 4.5, ignoreContent: ['https?://', 'data:image/'] },
      ],
    },
  },

  // Test files: relax documentation/size/duplication rules.
  {
    files: ['tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'jsdoc/require-jsdoc': 'off',
    },
  },

  // Disable type-checked rules where no type information is available.
  prettier,
);
