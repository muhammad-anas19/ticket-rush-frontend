import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // The FSD import rule is enforced by review for now. If it starts slipping, add
      // eslint-plugin-boundaries and encode the layer graph here — lower layers must never
      // import from higher ones, and same-layer cross-imports are forbidden.
    },
  },
];
