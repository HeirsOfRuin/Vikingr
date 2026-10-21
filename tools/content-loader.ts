// Loads /content (YAML) into one ContentBundle, validating every file against the schema.
// Cross-references (scene links, foe ids, flags...) are checked by tools/validate.ts.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { z } from 'zod';
import * as S from '../src/content/schema';

export class ContentError extends Error {}

const ROOT = join(import.meta.dirname, '..', 'content');

function read(path: string): unknown {
  try {
    return parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new ContentError(`${relative(ROOT, path)}: ${(e as Error).message}`);
  }
}

function check<T>(schema: z.ZodType<T>, data: unknown, where: string): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const lines = r.error.issues.slice(0, 8).map((i) => `  ${where}${i.path.length ? ' at ' + i.path.join('.') : ''}: ${i.message}`);
    throw new ContentError(`invalid content:\n${lines.join('\n')}`);
  }
  return r.data;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f.endsWith('.yaml') ? [p] : [];
  }).sort();
}

function byId<T extends { id: string }>(items: T[], what: string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const i of items) {
    if (out[i.id]) throw new ContentError(`duplicate ${what} id "${i.id}"`);
    out[i.id] = i;
  }
  return out;
}

export function loadContent(root = ROOT): S.ContentBundle {
  const reg = (f: string) => join(root, 'registry', f);
  const world = check(z.object({ places: z.array(S.place), legs: z.array(S.leg) }).strict(), read(join(root, 'places', 'places.yaml')), 'places/places.yaml');
  const scenes: S.Scene[] = [];
  const chapters: Record<string, string[]> = {};
  for (const f of walk(join(root, 'scenes'))) {
    const got = check(z.array(S.scene), read(f), relative(root, f));
    scenes.push(...got);
    // the folder is the chapter: an era that starts later counts the earlier chapters as past (docs/FRAME-LINEAGE.md D)
    const ch = relative(join(root, 'scenes'), f).split(/[\\/]/)[0]!;
    (chapters[ch] ??= []).push(...got.map((s) => s.id));
  }
  const bundle: Omit<S.ContentBundle, 'hash'> = {
    places: byId(world.places, 'place'),
    legs: world.legs,
    ships: byId(check(z.array(S.shipType), read(reg('ships.yaml')), 'registry/ships.yaml'), 'ship'),
    foes: byId(check(z.array(S.foe), read(reg('foes.yaml')), 'registry/foes.yaml'), 'foe'),
    fighters: byId(check(z.array(S.fighter), read(reg('fighters.yaml')), 'registry/fighters.yaml'), 'fighter'),
    men: byId(check(z.array(S.swornMan), read(reg('men.yaml')), 'registry/men.yaml'), 'sworn man'),
    rivals: byId(check(z.array(S.rival), read(reg('rivals.yaml')), 'registry/rivals.yaml'), 'rival'),
    injuries: byId(check(z.array(S.injury), read(reg('injuries.yaml')), 'registry/injuries.yaml'), 'injury'),
    deeds: byId(check(z.array(S.deedType), read(reg('deeds.yaml')), 'registry/deeds.yaml'), 'deed type'),
    flags: check(z.record(z.string(), S.flagDef), read(reg('flags.yaml')), 'registry/flags.yaml'),
    backgrounds: byId(check(z.array(S.background), read(join(root, 'backgrounds.yaml')), 'backgrounds.yaml'), 'background'),
    scenes: byId(scenes, 'scene'),
    chapters,
    names: check(z.array(z.string()), read(reg('names.yaml')), 'registry/names.yaml'),
    art: byId(check(z.array(S.artEntry), read(reg('art.yaml')), 'registry/art.yaml'), 'art'),
    captains: byId(check(z.array(S.captainDef), read(reg('captains.yaml')), 'registry/captains.yaml'), 'captain'),
    goods: byId(check(z.array(S.goodDef), read(reg('goods.yaml')), 'registry/goods.yaml'), 'good'),
    boasts: byId(check(z.array(S.boastDef), read(reg('boasts.yaml')), 'registry/boasts.yaml'), 'boast'),
    items: byId(check(z.array(S.itemDef), read(reg('items.yaml')), 'registry/items.yaml'), 'item'),
    fates: byId(check(z.array(S.fateDef), read(reg('fates.yaml')), 'registry/fates.yaml'), 'fate'),
    banter: check(z.array(S.banterLine), read(reg('banter.yaml')), 'registry/banter.yaml'),
    recruits: byId(check(z.array(S.recruitOrigin), read(reg('recruits.yaml')), 'registry/recruits.yaml'), 'recruit origin'),
    upbringing: byId(check(z.array(S.upbringingDef), read(reg('upbringing.yaml')), 'registry/upbringing.yaml'), 'upbringing'),
    coasts: byId(check(z.array(S.coastDef), read(reg('coasts.yaml')), 'registry/coasts.yaml'), 'coast'),
    lords: byId(check(z.array(S.lordDef), read(reg('lords.yaml')), 'registry/lords.yaml'), 'lord'),
    chronicle: (() => {
      const c = check(z.object({ events: z.array(S.chronEvent), raiders: z.array(S.chronRaider) }).strict(), read(reg('chronicle.yaml')), 'registry/chronicle.yaml');
      return { events: byId(c.events, 'chronicle event'), raiders: byId(c.raiders, 'chronicle raider') };
    })(),
    hostages: (() => {
      const h = check(z.object({ kinds: z.array(S.hostageKind), names: S.hostageNames }).strict(), read(reg('hostages.yaml')), 'registry/hostages.yaml');
      return { kinds: byId(h.kinds, 'hostage kind'), names: h.names };
    })(),
  };
  const hash = createHash('sha1').update(JSON.stringify(bundle)).digest('hex').slice(0, 12);
  return { hash, ...bundle };
}
