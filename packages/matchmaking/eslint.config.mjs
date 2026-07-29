import base from '@arena-core/eslint-config/node';

export default [
  ...base,
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  { ignores: ['dist/**'] },
];
