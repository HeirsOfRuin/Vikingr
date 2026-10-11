import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '../tools/content-loader';
import type { MapData } from '../src/engine/mapgrid';

export const content = loadContent();
export const map = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'content', 'map.json'), 'utf8')) as MapData;
