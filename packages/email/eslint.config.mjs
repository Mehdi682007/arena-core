import base from '@arena-core/eslint-config/node';

export default [
  ...base,
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  { ignores: ['dist/**'] },
];
