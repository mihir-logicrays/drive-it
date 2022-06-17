module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['prettier'],
  extends: ['prettier', 'plugin:@typescript-eslint/recommended'],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
  },
  env: { jest: true, browser: true, node: true },
  rules: {
    'no-console': 'warn',
    'prettier/prettier': 'error',
  },
};
