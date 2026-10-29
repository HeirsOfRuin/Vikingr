// Fight fairness (docs/FRAME-GAUNTLET.md, check 5): every fight the lives met, fought again many times from the
// state a life met it in, with fresh dice each time. A fight that is nearly always lost, or nearly always won,
// is flagged for a person to judge: some are meant to be (a hopeless last stand), most are not.
import type { ContentBundle, Effect } from '../../src/content/schema';
import type { GameState } from '../../src/engine/state';
import { act, listActions } from '../../src/engine/index';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { test } from '../../src/engine/conditions';
import { Bot } from '../bot-lib';

function fights(effects: Effect[] | undefined): boolean {
  return (effects ?? []).some((e) => 'battle' in e || 'host' in e || 'fight' in e || ('if' in e && (fights(e.then) || fights(e.else))));
}
/** The choices of a scene that start a fight, outright or on a failed or passed check. */
export function fightChoices(content: ContentBundle, sceneId: string): string[] {
  const s = content.scenes[sceneId];
  if (!s) return [];
  return s.choices.filter((c) => fights(c.effects) || fights(c.success?.effects) || fights(c.failure?.effects)).map((c) => c.id);
}

export interface FightResult { scene: string; choice: string; fought: number; won: number; died: number; how?: Record<string, number> }

/** Fight a scene's choice `trials` times from `start`, each time with fresh dice. */
export function trial(content: ContentBundle, start: GameState, choice: string, trials: number): FightResult {
  const sceneId = (start.pending as { id: string }).id;
  const r: FightResult = { scene: sceneId, choice, fought: 0, won: 0, died: 0 };
  const opt = listActions(start, content).find((o) => o.action.t === 'choose' && (o.action as { id: string }).id === choice);
  if (!opt?.enabled) return r;
  for (let t = 0; t < trials; t++) {
    let s = structuredClone(start);
    // fresh dice: the fight engines draw from the life's seed and the day as well as the game's stream
    s.rng = seedRng(0x9e3779b9 ^ (t * 7919 + 17));
    s.seed = (start.seed ^ (t * 2654435761)) >>> 0;
    const b0 = s.stats.battles + s.stats.duels, w0 = s.stats.battlesWon + s.stats.duelsWon;
    const bot = new Bot('raider', new RngCursor(seedRng(t + 1)));
    try {
      s = act(content, s, { t: 'choose', id: choice }, { inPlace: true });
      for (let i = 0; i < 400 && !s.death && s.stats.battles + s.stats.duels === b0; i++) {
        const a = bot.choose(s, content);
        if (!a) break;
        s = act(content, s, a, { inPlace: true });
      }
      // a single combat is counted before its end screen: play it out
      for (let i = 0; i < 20 && !s.death && (s.pending?.t === 'duel' || s.pending?.t === 'battle'); i++) {
        const a = bot.choose(s, content);
        if (!a) break;
        s = act(content, s, a, { inPlace: true });
      }
    } catch { continue; }
    if (s.death) { r.fought++; r.died++; continue; }
    if (s.stats.battles + s.stats.duels === b0) continue; // a passed check, a parley: no fight came of it
    r.fought++;
    const how = s.pending?.t === 'report' ? (s.pending as { title: string }).title : s.pending?.t ?? 'none';
    (r.how ??= {})[how] = (r.how[how] ?? 0) + 1;
    if (s.stats.battlesWon + s.stats.duelsWon > w0) r.won++;
  }
  return r;
}

/** Is this choice open in this state? (Only fights the player could have picked are tried.) */
export function open(content: ContentBundle, s: GameState, choice: string): boolean {
  const c = content.scenes[(s.pending as { id: string }).id]?.choices.find((x) => x.id === choice);
  return !!c && test(c.visible_if, s, content);
}

/** A start worth judging a fight from: a crew of fighting size, and a hero on his feet. */
export function healthy(s: GameState): boolean {
  return s.crew.men + s.men.filter((m) => m.alive).length >= 15 && s.hero.hp >= 8;
}
