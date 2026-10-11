import { render } from 'preact';
import { App } from './ui/App';
import bundle from './content/bundle.json';
import map from './content/map.json';
import type { ContentBundle } from './content/schema';
import type { MapData } from './engine/mapgrid';
import { registerPwa } from './pwa';
import './ui/fonts.css';
import './ui/styles.css';

render(<App content={bundle as unknown as ContentBundle} map={map as MapData} />, document.getElementById('app')!);
registerPwa();
