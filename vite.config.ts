import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// VITE_PWA=1: the installed app on Pages (service worker, assets as files).
// VITE_ARTIFACT=1: one self-contained file for a claude.ai preview (fonts and pictures inlined).
const artifact = process.env.VITE_ARTIFACT === '1';

export default defineConfig({
  base: './',
  plugins: [preact()],
  define: { __PWA__: JSON.stringify(process.env.VITE_PWA === '1'), __BUILD_ID__: JSON.stringify(String(Date.now())) },
  build: artifact ? { assetsInlineLimit: 100_000_000, outDir: 'dist-artifact-build', cssCodeSplit: false } : {},
  test: { include: ['tests/**/*.test.ts'] },
} as never);
