// Scene text: substitutions and conditional passages, so a scene can answer what came before.
//   {name}      the hero's given name          {fullname}  given name and patronymic
//   {nick}      his nickname, or his given name if he has none yet
//   {captain}   the man at the steering-oar when he rows in another man's ship; {ship} the ship he is in
//   [if cond]...[elif cond]...[else]...[/if]   (not nested; cond uses the condition grammar, with && and ||)
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

export function renderText(text: string, state: GameState, content: ContentBundle): string {
  const given = state.hero.name.split(' ')[0] ?? state.hero.name;
  const out = text.replace(IF, (_all, cond: string, body: string) => {
    for (const b of branches(body, cond)) if (b.cond === null || test(b.cond.trim(), state, content)) return b.text;
    return '';
  });
  return out
    .replace(/\{name\}/g, given)
    .replace(/\{fullname\}/g, state.hero.name)
    .replace(/\{nick\}/g, state.hero.nickname ?? given)
    .replace(/\{captain\}/g, state.service?.captain ?? 'the captain')
    .replace(/\{ship\}/g, state.ships[0]?.name ?? 'the ship')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

/** Validator: condition errors inside [if] passages, and unknown {tokens}. */
export function checkText(text: string, content: ContentBundle): string[] {
  const errs: string[] = [];
  for (const m of text.matchAll(IF)) for (const b of branches(m[2]!, m[1]!)) if (b.cond) errs.push(...validateCond(b.cond.trim(), content));
  const stray = text.replace(IF, '').match(/\[(?:if|elif|else|\/if)[^\]]*\]/);
  if (stray) errs.push(`unbalanced ${stray[0]}`);
  for (const m of text.matchAll(/\{([a-z]+)\}/g)) if (!['name', 'fullname', 'nick', 'captain', 'ship'].includes(m[1]!)) errs.push(`unknown text token {${m[1]}}`);
  return errs;
}
