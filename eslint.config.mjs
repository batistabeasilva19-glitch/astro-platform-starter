import { FlatCompat } from '@eslint/eslintrc';
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Mídias vêm de URLs assinadas do Supabase Storage (dinâmicas): <img> é intencional.
      '@next/next/no-img-element': 'off',
    },
  },
];
export default config;
