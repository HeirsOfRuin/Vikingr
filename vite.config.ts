import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  // the installed app (GitHub Pages) registers a service worker; the claude.ai artifact build does not
  define: { __PWA__: JSON.stringify(process.env.VITE_PWA === '1'), __BUILD_ID__: JSON.stringify(String(Date.now())) },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
