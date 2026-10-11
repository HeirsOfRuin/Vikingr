// Effect ops from content (DESIGN §17). Each op mutates the state copy the engine is working on.
import type { ContentBundle, Effect } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { addDeed } from './fame';
import { addWound, heal } from './hero';
import { addLoyalty, clampMorale, newMan } from './crew';
import { startDuel, startBattle } from './fights';
import { journal } from './journal';

function addTo(state: GameState, path: string, n: number): void {
  switch (path) {
    case 'silver': state.silver = Math.max(0, state.silver + n); return;
    case 'loot': state.loot = Math.max(0, state.loot + n); return;
    case 'honour': state.honour = Math.max(-10, Math.min(10, state.honour + n)); return;
    case 'hamingja': state.hamingja = Math.max(-5, Math.min(5, state.hamingja + n)); return;
    case 'provisions': state.provisions = Math.max(0, state.provisions + n); return;
    case 'crew.men': state.crew.men = Math.max(0, state.crew.men + n); return;
    case 'crew.morale': state.crew.morale += n; clampMorale(state); return;
  }
  const [ns, a, b] = path.split('.');
  if (ns === 'flag') state.flags[a!] = (state.flags[a!] ?? 0) + n;
  else if (ns === 'skill') state.hero.skills[a as keyof GameState['hero']['skills']] = Math.max(0, Math.min(10, state.hero.skills[a as keyof GameState['hero']['skills']] + n));
  else if (ns === 'attr') state.hero.attrs[a as keyof GameState['hero']['attrs']] = Math.max(1, Math.min(6, state.hero.attrs[a as keyof GameState['hero']['attrs']] + n));
  else if (ns === 'man' && b === 'loyalty') {
    const m = state.men.find((x) => x.id === a);
    if (m) addLoyalty(m, n);
  } else throw new Error(`cannot add to ${path}`);
}

export function applyEffects(state: GameState, content: ContentBundle, rng: RngCursor, effects: Effect[] | undefined): void {
  for (const e of effects ?? []) {
    if ('set' in e) state.flags[e.set.replace(/^flag\./, '')] = 1;
    else if ('clear' in e) delete state.flags[e.clear.replace(/^flag\./, '')];
    else if ('add' in e) for (const [k, v] of Object.entries(e.add)) addTo(state, k, v);
    else if ('deed' in e) addDeed(state, content, { ...e.deed, witnesses: e.deed.witnesses ?? state.crew.men });
    else if ('injury' in e) addWound(state, content, e.injury, 'what happened');
    else if ('man' in e) {
      const m = state.men.find((x) => x.id === e.man.id);
      if (e.man.join && !m) {
        state.men.push(newMan(content, e.man.id));
        journal(state, `${content.men[e.man.id]!.name} gave you his oath.`);
      } else if (m && e.man.leave) {
        state.men = state.men.filter((x) => x !== m);
        journal(state, `${m.name} left your service.`);
      }
      if (m && e.man.loyalty) addLoyalty(m, e.man.loyalty);
    } else if ('fight' in e) startDuel(state, content, e.fight.foe, e.fight.kind, e.fight.lethal, e.fight.win, e.fight.lose);
    else if ('battle' in e) startBattle(state, content, { ...e.battle, context: state.voyage ? 'sea' : 'scene', place: state.at });
    else if ('queue' in e) state.queue.push({ scene: e.queue.scene, day: state.day + e.queue.days });
    else if ('know' in e) { if (!state.known.includes(e.know)) state.known.push(e.know); }
    else if ('journal' in e) journal(state, e.journal);
    else if ('days' in e) { state.day += e.days; heal(state, content, e.days); }
  }
  void rng;
}
