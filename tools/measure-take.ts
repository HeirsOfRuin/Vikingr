// What a crew carries out of a place in three grabs, before and after the reach rule (src/engine/plunder.ts REACH;
// Josh, 2026-11-08: "too easy to become big and rich"). Expected values at the middle of the 14-26% roll.
// Usage: npx tsx tools/measure-take.ts
import { loadContent } from './content-loader';
import { plunderReach } from '../src/engine/plunder';

const content = loadContent();
const places = ['lindisfarne', 'bangor', 'whitby', 'gipeswic', 'london', 'york', 'dorestad', 'paris'];
const crews = [30, 60, 100, 200];
const lb = (o: number) => (o / 48).toFixed(0).padStart(3);
const three = (w: number, reach: number) => { let t = 0; for (let i = 0; i < 3; i++) { const s = w * 0.2 * reach; t += s; w -= s; } return t; };
console.log('place          defenders  wealth(lb) | three grabs, pounds, before → after, by men in the line: ' + crews.join(' / '));
for (const id of places) {
  const r = content.places[id]?.raid;
  if (!r) continue;
  const cells = crews.map((m) => `${lb(three(r.wealth, 1))}→${lb(three(r.wealth, plunderReach(m, r.defenders)))}`).join('   ');
  console.log(`${id.padEnd(14)} ${String(r.defenders).padStart(5)}   ${lb(r.wealth)}       | ${cells}`);
}
