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
    ignores: ['node_modules/', 'dist/', 'build/'],
  },
];
