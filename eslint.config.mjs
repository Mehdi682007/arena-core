import base from '@arena-core/eslint-config/base';

export default [
  {
    ignores: [
      '**/.next/**',
      '**/.turbo/**',
      '**/build/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      'outputs/**',
      'work/**',
    ],
  },
  ...base,
];
