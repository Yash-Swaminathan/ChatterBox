// Command to fix eslint errors: npm run lint:fix
// Command to format code prettier: npm run format


const globals = require('globals');

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Error Prevention
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off', // Allow console.log for server logs
      'no-undef': 'error',

      // Best Practices
      'eqeqeq': ['error', 'always'], // Require === instead of ==
      'no-var': 'error', // Use let/const instead of var
      'prefer-const': 'warn',
      'no-duplicate-imports': 'error',

      // Code Style (basic - Prettier handles most)
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'only-multiline'],

      // Node.js specific
      'no-process-exit': 'off', // Allow process.exit()
    },
  },
  {
    files: ['**/*.spec.js', '**/*.test.js', '**/__mocks__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.jest,
      },
    },
  },
  {
    // k6 load test scripts use ES module syntax (import/export)
    files: ['**/tests/load/**/*.k6.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.es2021,
        __ENV: 'readonly',
        __VU: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'build/'],
  },
];
