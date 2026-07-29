import nest from '@arena-core/eslint-config/nest';

export default [
  ...nest,
  {
    ignores: ['dist/**'],
  },
  {
    files: ['tests/**/*.mjs'],
    rules: {
      'import-x/no-unresolved': 'off',
    },
  },
];
