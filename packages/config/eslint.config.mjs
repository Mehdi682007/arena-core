import base from '@arena-core/eslint-config/node';

export default [
  ...base,
  {
    ignores: ['dist/**'],
  },
];
