import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.ts',
    './src/**/*.tsx',
    './src/**/*.html',
    './popup.html',
    './options.html',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;


