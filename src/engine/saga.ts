// The end of a life, told short: what men remembered, who carried him, where he lies.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { ageOn, dateOf } from './calendar';
import { aliveMen } from './crew';
import { capitalise, ordinal } from './format';
import { lastingFame, legendTable, livingFame } from './fame';

/** A deed's text as the start of a sentence. */
export function deedLine(text: string): string {
  return capitalise(text.trim());
}

export function epitaph(state: GameState, content: ContentBundle): string[] {
  const d = state.death!;
  const lines: string[] = [];
  const age = ageOn(d.day, state.hero.born);
  const summers = Math.max(1, dateOf(d.day).year - 829);
  lines.push(`${state.hero.nickname ? `${state.hero.name}, called ${state.hero.nickname},` : state.hero.name} was ${age} winters old, and had gone viking ${summers === 1 ? 'one summer' : `${summers} summers`}.`);
  // the heaviest deeds that were told
  const best = state.deeds.filter((x) => x.told !== null || x.verse).sort((a, b) => b.weight - a.weight || a.n - b.n).slice(0, 3);
  if (best.length) lines.push(`What men remembered of him: ${best.map((x) => deedLine(x.text)).join('. ')}.`);
  const verse = state.deeds.filter((x) => x.verse);
  if (verse.length) lines.push(`A skald made ${verse.length === 1 ? 'a verse' : `${verse.length} verses`} of it, and ${verse.length === 1 ? 'it is' : 'they are'} still said.`);
  // who buried him, and where
  const sworn = aliveMen(state).filter((m) => m.sworn).map((m) => m.name);
  const bearers = sworn.length ? `${sworn.length > 1 ? `${sworn.slice(0, -1).join(', ')} and ${sworn[sworn.length - 1]}` : sworn[0]} carried him` : 'They carried him';
  if (d.cause === 'drowned') lines.push('The sea kept him. They raised a stone for him above the fjord, with nobody under it.');
  else if (d.cause === 'straw') lines.push(`${bearers} up to the mound above the fjord, and the household went into the mound with ${state.base.wife ? `${state.base.wife} beside the grave` : 'his weapons'}.`);
  else if (state.at === 'home_fjord') lines.push(`${bearers} up to a mound above the fjord, with his weapons in his hands, and they drank his funeral ale for three days.`);
  else lines.push(`${bearers} down to the ships, and they buried him on a foreign shore, with his face to the north.`);
  // the völva at Yule 830 (y_volva): "Not in a bed. Not old. Not soon."
  if (state.flags.y_asked_death) {
    const wrong = d.cause === 'straw' ? 'in a bed' : age >= 50 ? 'old' : summers <= 2 ? 'soon' : null;
    lines.push(`Heiðr the völva had told him: not in a bed, not old, not soon. ${wrong ? `She was wrong about ${wrong === 'in a bed' ? 'the bed' : wrong === 'old' ? 'old' : 'soon'}. Völvas are, sometimes.` : 'She was right, as far as anyone could tell.'}`);
  }
  const rank = legendTable(state, content).findIndex((r) => r.hero) + 1;
  lines.push(`Fame ${Math.round(livingFame(state))}; lasting fame ${lastingFame(state)}. Among the living legends of his day he stood ${rank === 1 ? 'first' : ordinal(rank)}.`);
  return lines;
}

/** The choices the saga remembers (flags marked `saga` in the registry), in the order the registry tells them. */
export function remembered(state: GameState, content: ContentBundle): string[] {
  return Object.entries(content.flags).filter(([id, f]) => f.saga && state.flags[id]).map(([, f]) => deedLine(f.description));
}
