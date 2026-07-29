import next from '@arena-core/eslint-config/next';

const config = [
  ...next,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
  {
    files: ['src/features/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
  {
    files: ['tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'react/no-children-prop': 'off',
    },
  },
];

export default config;
