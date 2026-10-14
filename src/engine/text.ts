// Scene text: substitutions and conditional passages, so a scene can answer what came before.
//   {name}      the hero's given name          {fullname}  given name and patronymic
//   {nick}      his nickname, or his given name if he has none yet
//   {captain}   the man at the steering-oar when he rows in another man's ship; {ship} the ship he is in
//   {newship} the newest ship; {newmaster} the first hired steersman; {mastername} the first sworn shipmaster
//   {wife}      his wife's name                {reckoning} the Yule reckoning of this year's boasts
//   {father}    his father's name, by his beginning (Hall, Leysingr, Grímr)
//   [if cond]...[elif cond]...[else]...[/if]   (not nested; cond uses the condition grammar, with && and ||)
import { reckoning } from './boasts';
import { hiredShip, swornShip } from './fleet';
import { bestAlly, partner } from './allies';
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { test, validateCond } from './conditions';

const IF = /\[if ([^\]]+)\]([\s\S]*?)\[\/if\]/g;

function branches(body: string, firstCond: string): { cond: string | null; text: string }[] {
  const parts: { cond: string | null; text: string }[] = [];
  let cond: string | null = firstCond;
  let rest = body;
  for (;;) {
    const m = /\[(elif ([^\]]+)|else)\]/.exec(rest);
    if (!m) {
      parts.push({ cond, text: rest });
      return parts;
    }
    parts.push({ cond, text: rest.slice(0, m.index) });
    cond = m[2] ?? null;
    rest = rest.slice(m.index + m[0].length);
  }
}

export interface RenderOpts {
  /** Name the dead as themselves (mourning scenes). */
  keepDead?: boolean;
}

/** Sworn men who have died, and the oarsman who took each one's bench: scenes written before the death name him instead. */
function standIns(state: GameState, content: ContentBundle, opts?: RenderOpts): [RegExp, string, string][] {
  if (opts?.keepDead) return [];
  return state.men
    .filter((m) => !m.alive && state.standIns?.[m.id])
    .map((m) => [new RegExp(`\\b${content.men[m.id]?.name ?? m.name}\\b`, 'g'), state.standIns![m.id]!, m.id]);
}

export function renderText(text: string, state: GameState, content: ContentBundle, opts?: RenderOpts): string {
  const given = state.hero.name.split(' ')[0] ?? state.hero.name;
  const subs = standIns(state, content, opts);
  // a passage written around a man (its condition names him) keeps his name: the author meant him
  const out = text.replace(IF, (_all, cond: string, body: string) => {
    const keep = subs.filter(([, , id]) => body.includes(`man.${id}`) || cond.includes(`man.${id}`));
    for (const b of branches(body, cond)) {
      if (b.cond !== null && !test(b.cond.trim(), state, content)) continue;
      let t = b.text;
      for (const [re, , id] of keep) t = t.replace(re, `\u0001${id}\u0001`);
      return t;
    }
    return '';
  });
  let res = out;
  for (const [re, name] of subs) res = res.replace(re, name);
  for (const [, , id] of subs) res = res.replace(new RegExp(`\u0001${id}\u0001`, 'g'), content.men[id]?.name ?? id);
  return res
    .replace(/\{name\}/g, given)
    .replace(/\{fullname\}/g, state.hero.name)
    .replace(/\{nick\}/g, state.hero.nickname ?? given)
    .replace(/\{captain\}/g, state.service?.captain ?? 'the captain')
    .replace(/\{ship\}/g, state.ships[0]?.name ?? 'the ship')
    .replace(/\{wife\}/g, state.base.wife ?? 'your wife')
    .replace(/\{father\}/g, content.backgrounds[state.hero.background]?.father ?? 'your father')
    .replace(/\{ally\}/g, () => { const id = partner(state, content) ?? bestAlly(state, content); return id ? content.captains[id]!.name : 'a captain you know'; })
    .replace(/\{newship\}/g, state.ships[state.ships.length - 1]?.name ?? 'the new ship')
    .replace(/\{newmaster\}/g, () => { const s = hiredShip(state); return s ? s.master!.split(':')[1]! : 'the steersman'; })
    .replace(/\{mastername\}/g, () => { const s = swornShip(state); return s ? state.men.find((m) => `man:${m.id}` === s.master)!.name : 'your shipmaster'; })
    .replace(/\{reckoning\}/g, () => reckoning(state, content))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

/** Validator: condition errors inside [if] passages, and unknown {tokens}. */
export function checkText(text: string, content: ContentBundle): string[] {
  const errs: string[] = [];
  for (const m of text.matchAll(IF)) for (const b of branches(m[2]!, m[1]!)) if (b.cond) errs.push(...validateCond(b.cond.trim(), content));
  const stray = text.replace(IF, '').match(/\[(?:if|elif|else|\/if)[^\]]*\]/);
  if (stray) errs.push(`unbalanced ${stray[0]}`);
  for (const m of text.matchAll(/\{([a-z]+)\}/g)) if (!['name', 'fullname', 'nick', 'captain', 'ship', 'wife', 'reckoning', 'newship', 'newmaster', 'mastername', 'ally', 'father'].includes(m[1]!)) errs.push(`unknown text token {${m[1]}}`);
  return errs;
}
