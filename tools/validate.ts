// Content validator. Exit 1 on any error. Usage: npm run validate
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent, ContentError } from './content-loader';
import { validate } from './validate-lib';
import type { MapData } from '../src/engine/mapgrid';

try {
  const content = loadContent();
  const map = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'content', 'map.json'), 'utf8')) as MapData;
  const artFiles = readdirSync(join(import.meta.dirname, '..', 'src', 'art')).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4));
  const r = validate(content, map, artFiles);
  for (const i of r.info) console.log(`  info: ${i}`);
  for (const w of r.warnings) console.log(`  warning: ${w}`);
  for (const e of r.errors) console.log(`  ERROR: ${e}`);
  console.log(`validate: ${r.errors.length} errors, ${r.warnings.length} warnings`);
  if (r.errors.length) process.exit(1);
} catch (e) {
  if (e instanceof ContentError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
