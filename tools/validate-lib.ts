// Content validation: everything the schema cannot see. Broken links, undeclared
// references, lethal fights without a warning, places off the map, unreachable places.
import type { ContentBundle, Effect, Scene, Choice } from '../src/content/schema';
import { validateCond, condPaths } from '../src/engine/conditions';
import { checkAddPath, checkPath } from '../src/engine/paths';
import { checkText } from '../src/engine/text';
import { lonLatToTile, terrainAt, WATER, type MapData } from '../src/engine/mapgrid';

export interface Report {
  errors: string[];
  warnings: string[];
  info: string[];
}

/** artFiles: the ids of the pictures in src/art (without .png). Omit to skip the file checks. */
export function validate(content: ContentBundle, map: MapData, artFiles?: string[]): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  const flagSet = new Set<string>();
  const flagRead = new Set<string>();

  const sceneRef = (where: string, id: string | undefined) => {
    if (id && !content.scenes[id]) errors.push(`${where}: no scene "${id}"`);
  };
  const cond = (where: string, c: Parameters<typeof validateCond>[0] | undefined) => {
    if (c === undefined) return;
    for (const e of validateCond(c, content)) errors.push(`${where}: ${e}`);
    for (const p of condPaths(c)) if (p.startsWith('flag.')) flagRead.add(p.slice(5));
  };
  const effects = (where: string, list: Effect[] | undefined): { lethal: boolean } => {
    let lethal = false;
    for (const e of list ?? []) {
      if ('if' in e) {
        cond(where, e.if);
        lethal = effects(where, e.then).lethal || lethal;
        lethal = effects(where, e.else).lethal || lethal;
        continue;
      }
      if ('set' in e || 'clear' in e) {
        const path = 'set' in e ? e.set : e.clear;
        const f = path.replace(/^flag\./, '');
        if (!path.startsWith('flag.')) errors.push(`${where}: set/clear takes "flag.<id>", got "${path}"`);
        else if (!content.flags[f]) errors.push(`${where}: undeclared flag "${f}"`);
        else flagSet.add(f);
      } else if ('add' in e) {
        for (const k of Object.keys(e.add)) {
          const err = checkAddPath(content, k);
          if (err) errors.push(`${where}: ${err}`);
          if (k.startsWith('flag.')) flagSet.add(k.slice(5));
        }
      } else if ('deed' in e) {
        if (!content.deeds[e.deed.type]) errors.push(`${where}: unknown deed type "${e.deed.type}"`);
      } else if ('injury' in e) {
        if (!content.injuries[e.injury]) errors.push(`${where}: unknown injury "${e.injury}"`);
      } else if ('man' in e) {
        if (!content.men[e.man.id]) errors.push(`${where}: unknown sworn man "${e.man.id}"`);
      } else if ('fight' in e) {
        if (!content.fighters[e.fight.foe]) errors.push(`${where}: unknown fighter "${e.fight.foe}"`);
        sceneRef(where, e.fight.win);
        sceneRef(where, e.fight.lose);
        lethal ||= e.fight.lethal;
      } else if ('battle' in e) {
        if (!content.foes[e.battle.foe]) errors.push(`${where}: unknown foe "${e.battle.foe}"`);
        sceneRef(where, e.battle.win);
        sceneRef(where, e.battle.lose);
        sceneRef(where, e.battle.parted);
        lethal = true;
      } else if ('queue' in e) sceneRef(where, e.queue.scene);
      else if ('know' in e) {
        if (!content.places[e.know]) errors.push(`${where}: unknown place "${e.know}"`);
      } else if ('boast' in e || 'keep_boast' in e) {
        const b = 'boast' in e ? e.boast : e.keep_boast;
        if (!content.boasts[b]) errors.push(`${where}: unknown boast "${b}" (declare it in content/registry/boasts.yaml)`);
      } else if ('route' in e) {
        for (const p of e.route) if (!content.places[p]?.active) errors.push(`${where}: route place "${p}" is not an active place`);
      } else if ('plunder' in e) {
        sceneRef(where, e.plunder.next);
      } else if ('spread' in e) {
        if (!content.places[e.spread.from]) errors.push(`${where}: unknown place "${e.spread.from}"`);
      } else if ('raided' in e) {
        if (!content.places[e.raided.place]) errors.push(`${where}: unknown place "${e.raided.place}"`);
      } else if ('standing' in e) {
        if (e.standing.place && !content.places[e.standing.place]) errors.push(`${where}: unknown place "${e.standing.place}"`);
        if (!e.standing.place && !e.standing.people) errors.push(`${where}: standing needs a place or a people`);
      } else if ('ship' in e) {
        if (!content.ships[e.ship.type]) errors.push(`${where}: unknown ship type "${e.ship.type}"`);
      } else if ('voyage' in e) {
        if (!content.places[e.voyage]?.active) errors.push(`${where}: voyage to "${e.voyage}", not an active place`);
      }
    }
    return { lethal };
  };
  const text = (where: string, t: string | undefined) => {
    if (t) for (const e of checkText(t, content)) errors.push(`${where}: ${e}`);
  };
  const choice = (s: Scene, c: Choice) => {
    const where = `scene ${s.id} choice ${c.id}`;
    text(where, c.text);
    text(where, c.result);
    text(where, c.success?.text);
    text(where, c.failure?.text);
    cond(where, c.requires);
    cond(where, c.visible_if);
    sceneRef(where, c.next);
    let lethal = effects(where, c.effects).lethal;
    for (const o of [c.success, c.failure]) {
      if (!o) continue;
      lethal = effects(where, o.effects).lethal || lethal;
      sceneRef(where, o.next);
    }
    if ((c.success || c.failure) && !c.check) errors.push(`${where}: success/failure without a check`);
    if (lethal && !c.danger) errors.push(`${where}: can lead to a lethal fight but is not marked danger: true`);
  };

  // scenes
  let placeholders = 0;
  for (const s of Object.values(content.scenes)) {
    if (s.placeholder) placeholders++;
    text(`scene ${s.id}`, s.text);
    cond(`scene ${s.id}`, s.requires);
    if ((s.kind === 'place' || s.kind === 'pool' || s.kind === 'phase') && !s.trigger) errors.push(`scene ${s.id}: ${s.kind} scenes need a trigger`);
    if ((s.kind === 'spine' || s.kind === 'queued') && s.trigger) errors.push(`scene ${s.id}: ${s.kind} scenes are opened by links, not triggers`);
    if (s.trigger && s.chance === undefined && !s.once && s.cooldown_days === undefined) errors.push(`scene ${s.id}: a sure-fire triggered scene needs once or cooldown_days, or it fires every time`);
    for (const p of s.at ?? []) if (!content.places[p]) errors.push(`scene ${s.id}: unknown place "${p}"`);
    const ids = new Set<string>();
    for (const c of s.choices) {
      if (ids.has(c.id)) errors.push(`scene ${s.id}: duplicate choice id "${c.id}"`);
      ids.add(c.id);
      choice(s, c);
    }
    if (s.choices.every((c) => c.requires !== undefined || c.visible_if !== undefined)) warnings.push(`scene ${s.id}: every choice has a requirement or a visibility condition; it can dead-end`);
  }
  if (placeholders) info.push(`${placeholders} placeholder scenes (Phase 2 replaces them)`);

  // reachability of linked scenes from starts and triggers
  const reached = new Set<string>();
  const queue = [
    ...Object.values(content.backgrounds).map((b) => b.start_scene),
    ...Object.values(content.scenes).filter((s) => s.trigger || s.calibration).map((s) => s.id),
    // queued by the engine when a sworn man dies (fights.ts)
    ...Object.keys(content.scenes).filter((id) => id.startsWith('mourn_')),
  ];
  while (queue.length) {
    const id = queue.pop()!;
    if (reached.has(id) || !content.scenes[id]) continue;
    reached.add(id);
    for (const c of content.scenes[id]!.choices) {
      for (const n of [c.next, c.success?.next, c.failure?.next]) if (n) queue.push(n);
      const flat = (es: Effect[]): Effect[] => es.flatMap((e) => ('if' in e ? [...flat(e.then), ...flat(e.else ?? [])] : [e]));
      for (const e of flat([...(c.effects ?? []), ...(c.success?.effects ?? []), ...(c.failure?.effects ?? [])])) {
        if ('plunder' in e && e.plunder.next) queue.push(e.plunder.next);
        if ('fight' in e) queue.push(...[e.fight.win, e.fight.lose].filter((x): x is string => !!x));
        if ('battle' in e) queue.push(...[e.battle.win, e.battle.lose, e.battle.parted].filter((x): x is string => !!x));
        if ('queue' in e) queue.push(e.queue.scene);
      }
    }
  }
  for (const id of Object.keys(content.scenes)) if (!reached.has(id)) errors.push(`scene ${id}: unreachable (no start, trigger or link leads to it)`);

  // flags
  for (const f of Object.keys(content.flags)) {
    const bgSet = Object.values(content.backgrounds).some((b) => b.flags?.includes(f));
    if (!flagSet.has(f) && !bgSet) warnings.push(`flag ${f}: declared but never set by content`);
    if (!flagRead.has(f)) info.push(`flag ${f}: not read by any content condition (the engine may read it)`);
  }

  // places and the map
  for (const p of Object.values(content.places)) {
    const [x, y] = lonLatToTile(p.lon, p.lat);
    let landNear = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!WATER.has(terrainAt(map, x + dx, y + dy))) landNear = true;
    if (!landNear) errors.push(`place ${p.id}: (${p.lon}, ${p.lat}) is open water on the map`);
    if (p.raid && !content.foes[p.raid.foe]) errors.push(`place ${p.id}: unknown foe "${p.raid.foe}"`);
    if (p.known && !p.active) warnings.push(`place ${p.id}: known at the start but not active`);
  }
  for (const l of content.legs) {
    for (const end of [l.a, l.b]) if (!content.places[end]) errors.push(`leg ${l.a}–${l.b}: unknown place "${end}"`);
    if (content.places[l.a] && content.places[l.b] && (!content.places[l.a]!.active || !content.places[l.b]!.active)) errors.push(`leg ${l.a}–${l.b}: joins an inactive place`);
  }
  const active = Object.values(content.places).filter((p) => p.active).map((p) => p.id);
  const linked = new Set(['home_fjord']);
  let grew = true;
  while (grew) {
    grew = false;
    for (const l of content.legs) {
      if (linked.has(l.a) && !linked.has(l.b)) { linked.add(l.b); grew = true; }
      if (linked.has(l.b) && !linked.has(l.a)) { linked.add(l.a); grew = true; }
    }
  }
  for (const id of active) if (!linked.has(id)) errors.push(`place ${id}: active but no sea route reaches it from home`);
  info.push(`${active.length} active places, ${Object.keys(content.places).length - active.length} on the map for later phases`);

  // backgrounds
  for (const b of Object.values(content.backgrounds)) {
    sceneRef(`background ${b.id}`, b.start_scene);
    if (!content.ships[b.ship]) errors.push(`background ${b.id}: unknown ship type "${b.ship}"`);
    for (const m of b.men) if (!content.men[m]) errors.push(`background ${b.id}: unknown sworn man "${m}"`);
    for (const f of b.flags ?? []) if (!content.flags[f]) errors.push(`background ${b.id}: undeclared flag "${f}"`);
    const total = Object.values(b.attrs).reduce((a, v) => a + v, 0);
    if (total !== 11) errors.push(`background ${b.id}: attributes total ${total}, expected 11`);
    const sk = Object.values(b.skills).reduce((a: number, v) => a + (v ?? 0), 0);
    if (sk !== 7) errors.push(`background ${b.id}: skills total ${sk}, expected 7`);
  }

  // art
  const artRef = (where: string, key: string | undefined) => {
    if (key && !content.art[key]) errors.push(`${where}: no art "${key}" (declare it in content/registry/art.yaml)`);
  };
  for (const s of Object.values(content.scenes)) {
    artRef(`scene ${s.id}`, typeof s.art === 'string' ? s.art : s.art?.key);
    if (s.art && typeof s.art !== 'string' && s.art.laughter) {
      const e = checkPath(content, s.art.laughter);
      if (e) errors.push(`scene ${s.id} art laughter: ${e}`);
    }
    if (s.calibration && s.trigger) errors.push(`scene ${s.id}: calibration scenes are opened from the title screen, not triggers`);
  }
  for (const p of Object.values(content.places)) artRef(`place ${p.id}`, p.art);
  for (const a of Object.values(content.art)) {
    if (artFiles && !artFiles.includes(a.id)) errors.push(`art ${a.id}: no picture src/art/${a.id}.png (run tools/art.ts)`);
    for (const f of a.fx ?? []) {
      const pts: [number, number][] = 'rect' in f ? [[f.rect[0], f.rect[1]], [f.rect[0] + f.rect[2], f.rect[1] + f.rect[3]]] : [f.at];
      for (const [x, y] of pts) if (x < 0 || y < 0 || x > 400 || y > 160) errors.push(`art ${a.id}: ${f.kind} reaches outside the 400 × 160 picture`);
    }
  }
  for (const f of artFiles ?? []) if (!content.art[f]) warnings.push(`src/art/${f}.png is not in content/registry/art.yaml`);

  // banter, fates, boasts
  content.banter.forEach((b, i) => {
    if (!content.men[b.who]) errors.push(`banter line ${i + 1}: unknown man "${b.who}"`);
    cond(`banter line ${i + 1}`, b.requires);
    text(`banter line ${i + 1}`, b.text);
  });

  // rivals
  for (const r of Object.values(content.rivals)) {
    for (let i = 1; i < r.curve.length; i++) if (r.curve[i]![0] <= r.curve[i - 1]![0]) errors.push(`rival ${r.id}: curve years out of order`);
    if (r.curve[r.curve.length - 1]![0] >= r.died) errors.push(`rival ${r.id}: curve runs past his death`);
  }
  return { errors, warnings, info };
}
