import node from './node.mjs';

export default [
  ...node,
  {
    files: ['**/*.ts'],
    rules: {
      // Nest modules are intentionally decorator-only classes.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
