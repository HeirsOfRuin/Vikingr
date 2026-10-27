// Content validation: everything the schema cannot see. Broken links, undeclared
// references, lethal fights without a warning, places off the map, unreachable places.
import type { ContentBundle, Effect, Scene, Choice } from '../src/content/schema';
import { validateCond, condPaths, compileCond, type Cond } from '../src/engine/conditions';
import { checkAddPath, checkPath } from '../src/engine/paths';
import { checkText } from '../src/engine/text';
import { lonLatToTile, terrainAt, WATER, type MapData } from '../src/engine/mapgrid';
import { MAKEUP } from '../src/engine/makeup';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
        sceneRef(where, e.fight.parted);
        lethal ||= e.fight.lethal;
      } else if ('battle' in e) {
        if (!content.foes[e.battle.foe]) errors.push(`${where}: unknown foe "${e.battle.foe}"`);
        sceneRef(where, e.battle.win);
        sceneRef(where, e.battle.lose);
        sceneRef(where, e.battle.parted);
        lethal = true;
      } else if ('queue' in e) sceneRef(where, e.queue.scene);
      else if ('know' in e || 'camp' in e) {
        const pid = 'know' in e ? e.know : e.camp;
        if (!content.places[pid]) errors.push(`${where}: unknown place "${pid}"`);
      } else if ('boast' in e || 'keep_boast' in e) {
        const b = 'boast' in e ? e.boast : e.keep_boast;
        if (!content.boasts[b]) errors.push(`${where}: unknown boast "${b}" (declare it in content/registry/boasts.yaml)`);
      } else if ('route' in e) {
        for (const p of e.route) if (!content.places[p]?.active) errors.push(`${where}: route place "${p}" is not an active place`);
      } else if ('plunder' in e) {
        sceneRef(where, e.plunder.next);
      } else if ('item' in e || 'lose_item' in e) {
        const iid = 'item' in e ? e.item.id : e.lose_item;
        if (!content.items[iid]) errors.push(`${where}: unknown item "${iid}"`);
      } else if ('prize' in e) {
        if (!content.ships[e.prize.type]) errors.push(`${where}: unknown ship type "${e.prize.type}"`);
      } else if ('master' in e) {
        if (e.master !== 'hired' && !content.men[e.master]) errors.push(`${where}: master must be "hired" or a sworn man, not "${e.master}"`);
      } else if ('ally' in e) {
        if (e.ally.id !== 'best' && !content.captains[e.ally.id]) errors.push(`${where}: unknown captain "${e.ally.id}"`);
      } else if ('host' in e) {
        lethal = true;
        if (!content.foes[e.host.foe]) errors.push(`${where}: unknown foe "${e.host.foe}"`);
        for (const id of [e.host.win, e.host.lose]) if (id && !content.scenes[id]) errors.push(`${where}: no scene "${id}"`);
      } else if ('favour' in e) {
        /* nothing to check */
      } else if ('desert' in e || 'lose_cargo' in e) {
        /* nothing to check */
      } else if ('give_ship' in e) {
        if (e.give_ship !== 'master' && !content.men[e.give_ship]) errors.push(`${where}: unknown sworn man "${e.give_ship}"`);
      } else if ('wife' in e || 'base' in e || 'keep_captives' in e) {
        /* nothing to check */
      } else if ('progress' in e) {
        /* nothing to check */
      } else if ('spread' in e) {
        if (!content.places[e.spread.from]) errors.push(`${where}: unknown place "${e.spread.from}"`);
      } else if ('raided' in e) {
        if (!content.places[e.raided.place]) errors.push(`${where}: unknown place "${e.raided.place}"`);
      } else if ('standing' in e) {
        if (e.standing.place && !content.places[e.standing.place]) errors.push(`${where}: unknown place "${e.standing.place}"`);
        // neither place nor people: the port he is in (a no-op at sea)
      } else if ('ship' in e) {
        if (!content.ships[e.ship.type]) errors.push(`${where}: unknown ship type "${e.ship.type}"`);
      } else if ('voyage' in e) {
        if (!content.places[e.voyage]?.active) errors.push(`${where}: voyage to "${e.voyage}", not an active place`);
      } else if ('longphort' in e || 'longphort_lost' in e) {
        const pid = 'longphort' in e ? e.longphort : e.longphort_lost;
        if (!content.places[pid]) errors.push(`${where}: unknown place "${pid}"`);
      } else if ('take_hostage' in e) {
        if (e.take_hostage.place && !content.places[e.take_hostage.place]) errors.push(`${where}: unknown place "${e.take_hostage.place}"`);
        if (!content.hostages.kinds[e.take_hostage.kind]) errors.push(`${where}: unknown hostage kind "${e.take_hostage.kind}"`);
        if (e.take_hostage.captain && !content.captains[e.take_hostage.captain]) errors.push(`${where}: unknown captain "${e.take_hostage.captain}"`);
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
    // the hird and hostages (docs/FRAME-HIRD-HOSTAGES.md): a {cand} needs a candidate, a {hostage} needs a party
    if (s.candidate && !content.recruits[s.candidate]) errors.push(`scene ${s.id}: unknown recruit origin "${s.candidate}"`);
    const all = JSON.stringify(s);
    if (/\{cand(_desc)?\}|swear_cand|cand_crew/.test(all) && !s.candidate) errors.push(`scene ${s.id}: uses the candidate but names no candidate origin`);
    if (/\{hostage[a-z_]*\}|\{daughter\}|"hostage":"/.test(all) && !s.hostage) errors.push(`scene ${s.id}: uses a hostage but names no hostage selector`);
    const ids = new Set<string>();
    for (const c of s.choices) {
      if (ids.has(c.id)) errors.push(`scene ${s.id}: duplicate choice id "${c.id}"`);
      ids.add(c.id);
      choice(s, c);
    }
    // a choice open to anyone, or to the captain, or to the oarsman: a scene split between the two needs one of each
    const free = (side: 'service' | '!service' | null) => s.choices.some((c) => c.requires === undefined && (c.visible_if === undefined || (side !== null && c.visible_if === side)));
    if (!free(null) && !(free('service') && free('!service')) && !covers(s.choices)) warnings.push(`scene ${s.id}: every choice has a requirement or a visibility condition; it can dead-end`);
    // at the oar you choose what you do, not what the ship does (docs/FRAME-FLEET-843.md §1): a scene that can fire in
    // another man's ship may not offer an unmarked choice that fights, loads or steers the ship
    const reqText = JSON.stringify(s.requires ?? []);
    const canOar = ['pool', 'place', 'phase'].includes(s.kind) && !/!service|ships >= /.test(reqText) && !/placeholder_start|expedition/.test(reqText);
    if (canOar) {
      for (const c of s.choices) {
        if (c.oar || c.visible_if === 'service' || JSON.stringify(c.visible_if ?? '').includes('!service')) continue;
        const eff = JSON.stringify([c.effects, c.success?.effects, c.failure?.effects]);
        if (/"battle"|"host"|"captives"|"loot"|"provisions"|"crew\.men"|"progress"/.test(eff)) errors.push(`scene ${s.id} choice ${c.id}: a ship's decision open to an oarsman; mark it visible_if: "!service" and give the oar its own choice`);
      }
    }
  }
  if (placeholders) info.push(`${placeholders} placeholder scenes (Phase 2 replaces them)`);

  // discovery: what each port tells of, and the rumours its old sailors carry (FRAME-FOUNDATION §1)
  for (const p of Object.values(content.places)) {
    for (const id of [...(p.tells ?? []), ...(p.rumours ?? [])]) if (!content.places[id]) errors.push(`place ${p.id}: tells or rumours of unknown place "${id}"`);
    for (const id of p.rumours ?? []) if (!content.places[id]!.rumour) warnings.push(`place ${id}: rumoured at ${p.id} but has no rumour text`);
  }
  // the shore between the ports (playtest 10): every people's table names real foes and goods
  for (const [people, t] of Object.entries(content.strands.peoples)) {
    for (const k of ['local', 'church', 'lord'] as const) if (!content.foes[t[k]]) errors.push(`strands: ${people}.${k} names no foe "${t[k]}"`);
    for (const k of ['catch', 'farm', 'market'] as const) if (!content.goods[t[k]]) errors.push(`strands: ${people}.${k} names no good "${t[k]}"`);
  }
  for (const l of content.legs) if (l.expedition && content.places[l.a]?.known && content.places[l.b]?.known) warnings.push(`leg ${l.a}-${l.b}: an expedition between two places known from the start`);

  // reachability of linked scenes from starts and triggers
  const reached = new Set<string>();
  const queue = [
    ...Object.values(content.backgrounds).map((b) => b.start_scene),
    ...Object.values(content.scenes).filter((s) => s.trigger || s.calibration).map((s) => s.id),
    // queued by the engine when a sworn man dies (fights.ts)
    ...Object.keys(content.scenes).filter((id) => id.startsWith('mourn_')),
    // queued by the engine itself: a ship joining the fleet (src/engine/fleet.ts addShip)
    'fl_master',
    // queued by the hardship rolls (src/engine/hardship.ts)
    'ha_harvest', 'ha_fire',
    // hostages (src/engine/hostages.ts, plunder.ts): taken in a raid; a broken peace
    'hs_taken', 'hs_broken', 'hi_heir',
    // lords and rule (docs/FRAME-WORLD.md): found with two lords; a rival for the seat; the legends' years
    'lo_cast_out', 'ru_challenge', 'ru_danes', 'ru_rorik', 'g_w_son', 'g_w_daughter', 'fa_birth', 'fa_child_dies', 'fa_mound', 'st_fort_attack', 'st_fort_held', 'st_fort_lost', 'e43_boyhood', 'e65_boyhood', 'is_landnam', 'sk_verse',
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
        if ('fight' in e) queue.push(...[e.fight.win, e.fight.lose, e.fight.parted].filter((x): x is string => !!x));
        if ('battle' in e) queue.push(...[e.battle.win, e.battle.lose, e.battle.parted].filter((x): x is string => !!x));
        if ('host' in e) queue.push(...[e.host.win, e.host.lose].filter((x): x is string => !!x));
        if ('crewman' in e && e.crewman.fights) queue.push(...[e.crewman.fights.win, e.crewman.fights.lose].filter((x): x is string => !!x));
        if ('queue' in e) queue.push(e.queue.scene);
      }
    }
  }
  for (const id of Object.keys(content.scenes)) if (!reached.has(id)) errors.push(`scene ${id}: unreachable (no start, trigger or link leads to it)`);

  // flags (some are set by the engine, not by content: the end of exile, a broken promise at a wedding)
  const ENGINE_FLAGS = ['outlaw_ended', 'child_son', 'child_daughter', 'era843', 'ingibjorg_jilted', 'oathbreaker', 'ru_orkney', 'ru_dublin', 'ru_home', 'ru_walcheren', 'placeholder_start', 'era865',
    ...['harek', 'kolbeinn', 'horik', 'turgeis', 'irish_king', 'rorik'].flatMap((l) => [`call_${l}`, `served_${l}`])];
  const textRead = new Set<string>();
  const { flags: _f, ...rest } = content;
  for (const m of JSON.stringify(rest).replace(/"(set|clear)":"flag\.[a-z0-9_]+"/g, '').matchAll(/flag\.([a-z0-9_]+)/g)) textRead.add(m[1]!);
  for (const f of Object.keys(content.flags)) {
    const bgSet = Object.values(content.backgrounds).some((b) => b.flags?.includes(f));
    if (!flagSet.has(f) && !bgSet && !ENGINE_FLAGS.includes(f)) warnings.push(`flag ${f}: declared but never set by content`);
    // nothing declared is decoration: a flag is read by a condition, a passage of text, the engine, or the saga
    if (!flagRead.has(f) && !textRead.has(f) && !engineRead(f) && !content.flags[f]!.saga) warnings.push(`flag ${f}: set but never read (by a condition, a text, the engine or the saga)`);
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
  // coasts (docs/FRAME-PACING.md): every region named is a region on the map, with somewhere to raid in it
  const regions = new Set(Object.values(content.places).map((p) => p.region));
  for (const c of Object.values(content.coasts)) for (const r of c.regions) {
    if (!regions.has(r)) errors.push(`coast ${c.id}: no place is in region "${r}"`);
    else if (!Object.values(content.places).some((p) => p.region === r && p.raid)) warnings.push(`coast ${c.id}: nothing to raid in "${r}"`);
  }
  for (const b of Object.values(content.backgrounds)) {
    sceneRef(`background ${b.id}`, b.start_scene);
    if (!content.ships[b.ship]) errors.push(`background ${b.id}: unknown ship type "${b.ship}"`);
    for (const m of b.men) if (!content.men[m]) errors.push(`background ${b.id}: unknown sworn man "${m}"`);
    for (const f of b.flags ?? []) if (!content.flags[f]) errors.push(`background ${b.id}: undeclared flag "${f}"`);
    const total = Object.values(b.attrs).reduce((a, v) => a + v, 0);
    if (total !== 11) errors.push(`background ${b.id}: attributes total ${total}, expected 11`);
    if (Object.values(b.attrs).some((v) => v < MAKEUP.min || v > MAKEUP.max)) errors.push(`background ${b.id}: an attribute outside ${MAKEUP.min}-${MAKEUP.max}`);
    if (new Set(b.skill_sets.map((s) => s.id)).size !== b.skill_sets.length) errors.push(`background ${b.id}: two skill sets share an id`);
    for (const set of b.skill_sets) {
      const sk = Object.values(set.skills).reduce((a: number, v) => a + (v ?? 0), 0);
      if (sk !== MAKEUP.skillPoints) errors.push(`background ${b.id} skill set ${set.id}: skills total ${sk}, expected ${MAKEUP.skillPoints}`);
    }
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
  // trade: every good a market names must exist, and nothing is both cheap and dear
  for (const p of Object.values(content.places)) {
    if (!p.trade) continue;
    for (const g of [...p.trade.cheap, ...p.trade.dear]) if (!content.goods[g]) errors.push(`place ${p.id}: unknown good "${g}" in trade`);
    for (const g of p.trade.cheap) if (p.trade.dear.includes(g)) errors.push(`place ${p.id}: "${g}" is both cheap and dear`);
  }
  // a good no market sells is fine if scenes hand it over (silk from Seville); one nobody wants is not
  const handed = new Set([...JSON.stringify(Object.values(content.scenes)).matchAll(/"goods":\{"id":"([a-z_]+)"/g)].map((m) => m[1]));
  for (const g of Object.keys(content.goods)) {
    if (!handed.has(g) && !Object.values(content.places).some((p) => p.trade?.cheap.includes(g))) warnings.push(`good ${g}: no market sells it`);
    if (!Object.values(content.places).some((p) => p.trade?.dear.includes(g) || p.trade?.cheap.includes(g))) warnings.push(`good ${g}: no market trades it`);
  }
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
    if (typeof b.who === 'string' && !content.men[b.who]) errors.push(`banter line ${i + 1}: unknown man "${b.who}"`);
    if (typeof b.who !== 'string' && !b.text.includes('{man}')) errors.push(`banter line ${i + 1}: a temperament line must name its man with {man}`);
    cond(`banter line ${i + 1}`, b.requires);
    text(`banter line ${i + 1}`, b.text);
  });
  for (const b of Object.values(content.boasts)) if (b.goal && 'when' in b.goal) cond(`boast ${b.id}`, b.goal.when);
  for (const c of Object.values(content.captains)) {
    if (!content.places[c.home]) errors.push(`captain ${c.id}: unknown home "${c.home}"`);
    for (const b of c.bias ?? []) cond(`captain ${c.id} bias`, b.if);
  }

  // rivals
  for (const r of Object.values(content.rivals)) {
    for (let i = 1; i < r.curve.length; i++) if (r.curve[i]![0] <= r.curve[i - 1]![0]) errors.push(`rival ${r.id}: curve years out of order`);
    if (r.curve[r.curve.length - 1]![0] >= r.died) errors.push(`rival ${r.id}: curve runs past his death`);
  }
  return { errors, warnings, info };
}

/** Do the unrequired choices' visibility conditions cover every case? A truth table over their atoms, where a flag or
 *  `x == v` is one variable and its negation (`!x`, `x != v`) is the same variable flipped. Other comparisons are
 *  free variables, so the check never claims cover it can't prove. */
export function covers(choices: Choice[]): boolean {
  const open = choices.filter((c) => c.requires === undefined);
  if (open.some((c) => c.visible_if === undefined)) return true;
  const conds = open.map((c) => compileCond(c.visible_if!));
  const vars = new Map<string, number>();
  const key = (c: Cond): [string, boolean] | null => {
    if (c.t === 'truthy') return [c.path, !c.neg];
    if (c.t === 'cmp' && (c.op === '==' || c.op === '!=')) return [`${c.path}==${String(c.value)}`, c.op === '=='];
    if (c.t === 'cmp') return [c.src, true];
    return null;
  };
  const walk = (c: Cond): void => { const k = key(c); if (k) { if (!vars.has(k[0])) vars.set(k[0], vars.size); } else if (c.t === 'not') walk(c.of); else if (c.t === 'all' || c.t === 'any') c.of.forEach(walk); };
  conds.forEach(walk);
  if (vars.size > 12) return false;
  const ev = (c: Cond, bits: number): boolean => {
    const k = key(c);
    if (k) return (((bits >> vars.get(k[0])!) & 1) === 1) === k[1];
    if (c.t === 'not') return !ev(c.of, bits);
    if (c.t === 'all') return c.of.every((x) => ev(x, bits));
    if (c.t === 'any') return c.of.some((x) => ev(x, bits));
    return false;
  };
  for (let bits = 0; bits < 1 << vars.size; bits++) if (!conds.some((c) => ev(c, bits))) return false;
  return true;
}

/** Flags the engine reads by name (`flags.x`, `flags['x']`) or by a pattern it builds (`${place}_scouted`, `ru_${seat}_lost`). */
let engineFlags: Set<string> | undefined;
function engineRead(f: string): boolean {
  if (!engineFlags) {
    engineFlags = new Set();
    // the engine, and the measurement tools (a flag a harness counts is read: harnesses prove progress)
    for (const dir of [join(process.cwd(), 'src', 'engine'), join(process.cwd(), 'tools')]) {
      for (const file of readdirSync(dir).filter((x) => x.endsWith('.ts') && x !== 'validate-lib.ts')) {
        for (const m of readFileSync(join(dir, file), 'utf8').matchAll(/flags(?:\.([a-z0-9_]+)|\['([a-z0-9_]+)'\])|'([a-z0-9_]+)'/g)) engineFlags.add((m[1] ?? m[2] ?? m[3])!);
      }
    }
  }
  return engineFlags.has(f) || /_scouted$/.test(f) || /^ru_[a-z]+_lost$/.test(f);
}
