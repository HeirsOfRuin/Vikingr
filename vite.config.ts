import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync } from 'node:fs';

// VITE_PWA=1: the installed app on Pages (service worker, assets as files).
// VITE_ARTIFACT=1: one self-contained file for a claude.ai preview (fonts and pictures inlined).
// VITE_RELEASE=1: what players get (Pages, itch): no playtest chapter jumps, no debug dump.
const artifact = process.env.VITE_ARTIFACT === '1';
const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;

export default defineConfig({
  base: './',
  plugins: [preact()],
  define: { __PWA__: JSON.stringify(process.env.VITE_PWA === '1'), __BUILD_ID__: JSON.stringify(String(Date.now())), __RELEASE__: JSON.stringify(process.env.VITE_RELEASE === '1'), __VERSION__: JSON.stringify(version) },
  build: artifact ? { assetsInlineLimit: 100_000_000, outDir: 'dist-artifact-build', cssCodeSplit: false } : {},
  test: { include: ['tests/**/*.test.ts'] },
} as never);
