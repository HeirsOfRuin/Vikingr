// Compiles /content into src/content/bundle.json for the browser build.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent, ContentError } from './content-loader';

try {
  const bundle = loadContent();
  writeFileSync(join(import.meta.dirname, '..', 'src', 'content', 'bundle.json'), JSON.stringify(bundle));
  console.log(`content: ${Object.keys(bundle.scenes).length} scenes, ${Object.keys(bundle.places).length} places, hash ${bundle.hash}`);
} catch (e) {
  if (e instanceof ContentError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
