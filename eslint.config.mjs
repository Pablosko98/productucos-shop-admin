import js from '@eslint/js';
import globals from 'globals';
import pluginReact from 'eslint-plugin-react';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
    ignores: [
      '.expo/*',
      'expo-env.d.ts',
      'nativewind-env.d.ts',
      'node_modules/*',
      'dist/*',
      'ios/*',
      'android/*',
    ],
  },
  pluginReact.configs.flat.recommended,
]);
