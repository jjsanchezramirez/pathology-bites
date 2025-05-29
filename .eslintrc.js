// .eslintrc.js
module.exports = {
    extends: [
      'next/core-web-vitals',
      'plugin:@typescript-eslint/recommended'
    ],
    ignorePatterns: ['.next/**/*', 'node_modules/**/*'],
    plugins: [
      'unused-imports'
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@next/next/no-img-element': 'warn',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_'
        }
      ]
    }
  }