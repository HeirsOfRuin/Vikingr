// Rule (docs/FRAME-WORLD.md §E): jarl or king of a place, against a rival with a name. The claim is one number,
// shown in full, and so is the rival's; a legend's claim is his fame on the same table as the hero's.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { livingFame, legendFame, addDeed, LEGEND_SCALE } from './fame';
import { aliveMen } from './crew';
import { journal } from './journal';
import { formatSilver, plural } from './format';
import { lordAlive, lordDies, lordFav, lordName, swornTo } from './lords';
import { standing } from './standing';
import { holdingAt } from './land';
import { earn } from './hardship';

export type Seat = 'orkney' | 'dublin' | 'home' | 'walcheren' | 'york' | 'eastangles' | 'nottingham' | 'loire' | 'isles' | 'frisia' | 'lordship';
/** The seats with a place of their own (docs/FRAME-FLEETS-REALMS.md, Part B adds six). `lordship` is any holding raised up, and is not listed. */
export const SEATS: Seat[] = ['orkney', 'dublin', 'home', 'walcheren', 'york', 'eastangles', 'nottingham', 'loire', 'isles', 'frisia'];
/** A holding held this many winters can be raised into a lordship of his own. */
export const LORDSHIP = { winters: 3, minFame: 80 } as const;

export const RULE = {
  tribute: 120,
  men: 10,
  deed: 40,
  /** He must be seen: winter at the seat at least this often (years), or it falls to the rival. */
  absent: 2,
  /** A rival's challenge, a year. */
  challenge: 0.25,
  /** One of the seat's own troubles, a year. */
  seatEvent: 0.5,
  /** Claim: his name counts for half, men for half, the old lord's favour five a point, standing three. */
  perFame: 0.5,
  perMan: 0.5,
  /** A legend's claim: half his fame, and his fleet. */
  legendBase: 100,
  perFavour: 5,
  perStanding: 3,
  kin: 40,
  /** A lord's favour that ties a man to his seat. */
  tieFavour: 3,
  land: 20,
  /** The jarl in Hordaland dies in a year between these. */
  jarlDies: [842, 850] as [number, number],
} as const;

export const SEAT_DEF: Record<Seat, { place: string; title: string; lord?: string; minFame: number }> = {
  orkney: { place: 'orkney', title: 'jarl in Orkney', lord: 'harek', minFame: 120 },
  dublin: { place: 'dublin', title: 'king in Dublin', minFame: 150 },
  home: { place: 'home_fjord', title: 'jarl in Hordaland', lord: 'jarl', minFame: 150 },
  walcheren: { place: 'walcheren', title: 'count of Walcheren', minFame: 150 },
  // where the Northmen did rule (docs/FRAME-FLEETS-REALMS.md, Part B)
  york: { place: 'york', title: 'king in Jórvík', minFame: 160 },
  eastangles: { place: 'thetford', title: 'king of the East Angles', minFame: 160 },
  nottingham: { place: 'nottingham', title: 'jarl in Snotingaham', minFame: 130 },
  loire: { place: 'noirmoutier', title: 'lord of the Loire Northmen', minFame: 130 },
  isles: { place: 'man', title: 'king of Man and the Isles', minFame: 140 },
  frisia: { place: 'dorestad', title: 'lord of Frisia', minFame: 150 },
  lordship: { place: '', title: 'lord', minFame: LORDSHIP.minFame },
};

/** `place`: a lordship's own place, the holding he raised up. */
/** Each new seat's troubles, in the order they come (content/scenes/world/realms.yaml). */
export const SEAT_EVENTS: Partial<Record<Seat, string[]>> = {
  york: ['rl_york_archbishop', 'rl_york_rising', 'rl_york_coin'],
  eastangles: ['rl_ea_edmund', 'rl_ea_border'],
  nottingham: ['rl_nt_ceolwulf', 'rl_nt_boroughs'],
  loire: ['rl_lo_bretons', 'rl_lo_monks'],
  isles: ['rl_is_poet', 'rl_is_dublin'],
  frisia: ['rl_fr_emperor', 'rl_fr_dikes'],
  lordship: ['rl_ld_hall', 'rl_ld_neighbours'],
};

export interface RuleState { seat: Seat; since: number; seen: number; place?: string; title?: string }

/** Where a seat sits, and what he is called there. */
export function seatPlace(state: GameState, seat: Seat): string {
  return seat === 'lordship' ? (state.rule?.seat === 'lordship' ? state.rule.place ?? state.at ?? '' : state.at ?? '') : SEAT_DEF[seat].place;
}
export function seatTitle(state: GameState, content: ContentBundle, seat: Seat): string {
  return seat === 'lordship' ? `lord of ${content.places[seatPlace(state, seat)]?.name ?? 'his land'}` : SEAT_DEF[seat].title;
}
/** The place and title of the seat he holds. */
export function ruleDef(state: GameState, content: ContentBundle): { place: string; title: string } | null {
  return state.rule ? { place: seatPlace(state, state.rule.seat), title: state.rule.title ?? seatTitle(state, content, state.rule.seat) } : null;
}

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The year the jarl in Hordaland dies, fixed for each life. */
export function jarlDies(state: GameState): number {
  const [a, b] = RULE.jarlDies;
  return a + (hashOf(`${state.seed}:jarl`) % (b - a + 1));
}

/** Who stands against him for the seat, and his claim. */
export function rivalOf(state: GameState, content: ContentBundle, seat: Seat): { name: string; claim: number; legend?: string } {
  const year = dateOf(state.day).year;
  switch (seat) {
    case 'orkney': return { name: 'Sigurðr, Harek\'s sister\'s son', claim: 170 };
    case 'dublin':
      if (year < 845) return { name: 'Turgeis', claim: legendClaim(state, content, 'turgeis', year), legend: 'turgeis' };
      // the brother who lost the thing in 834 went to Ireland; else the loud Rogalander from the fort's first winter
      return state.flags.fr_jarl_eirik ? { name: 'Hákon Eysteinsson', claim: 180 } : state.flags.fr_jarl_hakon ? { name: 'Eiríkr Eysteinsson', claim: 180 } : { name: 'Bárðr the Rogalander', claim: 170 };
    case 'home': return { name: 'young Eysteinn, the jarl\'s son', claim: 180 };
    case 'walcheren': return { name: 'Rorik', claim: legendClaim(state, content, 'rorik', year), legend: 'rorik' };
    case 'york': return year < 877 ? { name: 'Hálfdan', claim: legendClaim(state, content, 'halfdan', year), legend: 'halfdan' } : { name: 'Guðrøðr, the army\'s choice', claim: 190 };
    case 'eastangles': return year < 878 ? { name: 'Æthelred, the English king the army set up', claim: 150 } : { name: 'Guthrum', claim: 210 };
    case 'nottingham': return { name: 'Þorkell, a jarl of the army', claim: 160 };
    case 'loire': return { name: 'Hastein', claim: legendClaim(state, content, 'hastein', year), legend: 'hastein' };
    case 'isles': return year < 853 ? { name: 'Gofraid, son of Fergus', claim: 170 } : { name: 'Ketill, called Flatnose', claim: 180 };
    case 'frisia': return { name: 'Rorik', claim: legendClaim(state, content, 'rorik', year), legend: 'rorik' };
    case 'lordship': return { name: 'nobody', claim: 0 };
  }
}

/** A legend's claim: half his fame as men tell it, and his fleet. */
function legendClaim(state: GameState, content: ContentBundle, id: string, year: number): number {
  return Math.round(RULE.legendBase + RULE.perFame * (legendFame(state, content.rivals[id]!, year) / LEGEND_SCALE));
}

/** His claim, part by part: what the thing will weigh. */
export function claimParts(state: GameState, content: ContentBundle, seat: Seat): { label: string; n: number }[] {
  const d = { ...SEAT_DEF[seat], place: seatPlace(state, seat) };
  const parts: { label: string; n: number }[] = [
    { label: 'your name', n: Math.round(livingFame(state) * RULE.perFame) },
    { label: 'your men', n: Math.round((state.crew.men + aliveMen(state).length) * RULE.perMan) },
  ];
  if (d.lord) parts.push({ label: `${lordName(state, content, d.lord)}'s favour`, n: Math.max(0, lordFav(state, d.lord)) * RULE.perFavour });
  if (d.place !== 'home_fjord') parts.push({ label: 'what they think of you there', n: Math.max(0, standing(state, content, d.place)) * RULE.perStanding });
  if (seat === 'orkney' && state.flags.wife_ingibjorg) parts.push({ label: 'Harek\'s daughter for your wife', n: RULE.kin });
  if (seat === 'home' && state.base.level === 'hall') parts.push({ label: 'a hall of your own', n: RULE.land });
  if (seat !== 'home' && holdingAt(state, d.place)) parts.push({ label: 'land of your own there', n: RULE.land });
  if (seat === 'dublin' && state.flags.ir_fort_lord) parts.push({ label: 'the high seat of the ship-fort', n: RULE.land });
  if ((seat === 'york' || seat === 'nottingham' || seat === 'eastangles') && state.flags.ga_army) parts.push({ label: 'a captain of the army', n: RULE.land });
  if (seat === 'eastangles' && state.flags.ru_baptised) parts.push({ label: 'baptised, with a treaty', n: RULE.kin });
  if (seat === 'loire' && (state.flags.bx_taken || state.flags.mh_went)) parts.push({ label: 'what you did with Hastein', n: RULE.land });
  return parts.filter((p) => p.n > 0);
}

export function claim(state: GameState, content: ContentBundle, seat: Seat): number {
  return claimParts(state, content, seat).reduce((n, p) => n + p.n, 0);
}

/** His claim less the rival's: what the condition path claim.<seat> reads. */
export function claimMargin(state: GameState, content: ContentBundle, seat: Seat): number {
  return claim(state, content, seat) - rivalOf(state, content, seat).claim;
}

/** The seat is open to a claim now. */
export function seatOpen(state: GameState, content: ContentBundle, seat: Seat): boolean {
  return seatStatus(state, content, seat).open;
}

/** Whether the seat is open, and if not, every reason, each with the way past it (Josh, 2026-11-09: "I still can't take
 *  Dyflinn or Mön as my own!", and nothing said why). seatOpen reads this, so the words and the rule cannot differ. */
export function seatStatus(state: GameState, content: ContentBundle, seat: Seat): { open: boolean; why: string[] } {
  const why: string[] = [];
  if (state.rule) return { open: false, why: ['You hold a seat already.'] };
  if (state.flags[`ru_${seat}_lost`]) return { open: false, why: [`It went to ${rivalOf(state, content, seat).name}; it will not be offered to you again.`] };
  const year = dateOf(state.day).year;
  const d = SEAT_DEF[seat];
  const fame = livingFame(state);
  if (fame < d.minFame) why.push(`Your name is not great enough yet: ${Math.round(fame)} of ${d.minFame}.`);
  if (!tied(state, content, seat)) why.push(TIES[seat]);
  switch (seat) {
    case 'orkney': { const dies = lordDies(state, content, 'harek'); if (!(dies !== null && year >= dies)) why.push('Harek is still jarl: the seat opens when he dies.'); break; }
    case 'dublin':
      if (!state.places.dublin?.norse) why.push('Dyflinn is an Irish place until the Norse hold it: take it and dig a ship-fort there, or wait for the Norse fleets to build one.');
      else if (!(year >= 845 || !lordAlive(state, content, 'turgeis') || claimMargin(state, content, 'dublin') > 0)) why.push('Turgeis calls every foreigner in Ireland his man: your claim must beat his.');
      break;
    case 'home': if (!(year >= jarlDies(state))) why.push('The jarl in Hordaland still lives.'); if (state.flags.outlawed) why.push('An outlaw cannot be jarl where he was outlawed.'); break;
    case 'walcheren': if (year < 841) why.push('The emperor\'s count holds it until the Danes come for it (841).'); break;
    case 'york': if (!(year >= 867 && (!!state.places.york?.norse || !!state.flags.ga_army))) why.push('Not until the great army takes York (867).'); break;
    case 'eastangles': if (year < 870) why.push('Not until the great army takes East Anglia (870).'); break;
    case 'nottingham': if (year < 877) why.push('Not until the army shares out Mercia (877).'); break;
    case 'loire': if (!(year >= 845 && !!state.places.noirmoutier?.norse)) why.push('Not until the Northmen hold the island at the Loire\'s mouth for good (845).'); break;
    case 'isles': if (!(year >= 850 || !!holdingAt(state, 'man'))) why.push('The Norse kings of the Isles come about 850; hold land or a ship-fort on Mön and you are one already.'); break;
    case 'frisia': if (!(year >= 850 && year <= 873)) why.push(year < 850 ? 'Not until the emperor gives Frisia to the Northmen (850).' : 'Frisia is the emperor\'s again.'); break;
    case 'lordship': if (!lordshipReady(state, content)) why.push(`Hold land ${LORDSHIP.winters} winters, and stand on it.`); break;
  }
  return { open: why.length === 0, why };
}

/** What ties a man to each seat, said as the way to get it. */
const TIES: Record<Seat, string> = {
  orkney: 'You need a tie to Orkney: Harek\'s oath or his favour, or his daughter for your wife.',
  dublin: 'You need a tie to Dyflinn: a place among the ship-fort\'s captains, or land or a ship-fort at Dyflinn or Linn Duachaill.',
  home: 'You need a tie to Hordaland: the jarl\'s favour, or a hall of your own.',
  walcheren: 'You need a tie to Walcheren: not to be hated there.',
  york: 'You need a tie to York: to sail with the great army, or land there.',
  eastangles: 'You need a tie to East Anglia: to sail with the great army, or land there.',
  nottingham: 'You need a tie to Mercia: to sail with the great army, or land at Snotingaham or Repton.',
  loire: 'You need a tie to the Loire: land or a fort there, or to have sailed with its fleets.',
  isles: 'You need a tie to the Isles: land or a ship-fort on Mön, Skye or Iona, or a good name on Mön.',
  frisia: 'You need a tie to Frisia: land at Dorestad or Walcheren, or a good name at Dorestad.',
  lordship: '',
};

/** A holding of his, held long enough, at the place he stands: he can be called its lord. */
export function lordshipReady(state: GameState, content: ContentBundle): boolean {
  if (state.rule || !state.at || livingFame(state) < LORDSHIP.minFame) return false;
  const h = holdingAt(state, state.at);
  if (!h) return false;
  // a place with a seat of its own is claimed as that seat, not as a lordship
  if (SEATS.some((s) => SEAT_DEF[s].place === state.at)) return false;
  void content;
  return dateOf(state.day).year - dateOf(h.since).year >= LORDSHIP.winters;
}

/** A claim needs a tie to the place: a stranger, however famous, is not asked (docs/FRAME-WORLD.md §E). */
export function tied(state: GameState, content: ContentBundle, seat: Seat): boolean {
  switch (seat) {
    case 'orkney': return swornTo(state, 'harek') || lordFav(state, 'harek') >= RULE.tieFavour || !!state.flags.wife_ingibjorg;
    case 'dublin': return !!state.flags.ir_fort_member || !!holdingAt(state, 'dublin') || !!holdingAt(state, 'linn_duachaill');
    case 'home': return lordFav(state, 'jarl') >= RULE.tieFavour || state.base.level === 'hall';
    case 'walcheren': return standing(state, content, 'walcheren') >= 0;
    case 'york': return !!state.flags.ga_army || !!holdingAt(state, 'york');
    case 'eastangles': return !!state.flags.ga_army || !!holdingAt(state, 'thetford') || !!holdingAt(state, 'gipeswic');
    case 'nottingham': return !!state.flags.ga_army || !!holdingAt(state, 'nottingham') || !!holdingAt(state, 'repton');
    case 'loire': return !!holdingAt(state, 'noirmoutier') || !!holdingAt(state, 'nantes') || !!state.flags.cw_nantes_sworn || !!state.flags.bx_sworn || !!state.flags.mh_went;
    case 'isles': return !!holdingAt(state, 'man') || !!holdingAt(state, 'skye') || !!holdingAt(state, 'iona') || standing(state, content, 'man') >= 3;
    case 'frisia': return !!holdingAt(state, 'dorestad') || !!holdingAt(state, 'walcheren') || standing(state, content, 'dorestad') >= 2;
    case 'lordship': return true;
  }
}

/** The words for the claim, for the scene: "Your claim: 140 (your name 96, your men 22, ...). Sigurðr's: 170." */
export function claimWords(state: GameState, content: ContentBundle, seat: Seat): string {
  const parts = claimParts(state, content, seat);
  // a lordship of his own has no rival: only what he has built there (playtest 2026-11-08: "nobody's: 0")
  if (seat === 'lordship') return `What you have there: ${parts.map((p) => `${p.label} ${p.n}`).join(', ')}.`;
  const r = rivalOf(state, content, seat);
  return `Your claim: ${claim(state, content, seat)} (${parts.map((p) => `${p.label} ${p.n}`).join(', ')}). ${r.name}'s: ${r.claim}${r.legend ? ', his name on every beach' : ''}.`;
}

export function ruleTitle(state: GameState, content?: ContentBundle): string | null {
  if (!state.rule) return null;
  return state.rule.title ?? (content ? seatTitle(state, content, state.rule.seat) : SEAT_DEF[state.rule.seat].title);
}

/** He takes the seat. */
export function takeSeat(state: GameState, content: ContentBundle, seat: Seat): void {
  const place = seatPlace(state, seat);
  const d = { place, title: seatTitle(state, content, seat) };
  state.rule = { seat, since: state.day, seen: dateOf(state.day).year, title: d.title, ...(seat === 'lordship' ? { place } : {}) };
  state.flags[`ru_${seat}`] = 1;
  const ps = state.places[d.place];
  if (ps && d.place !== 'home_fjord') ps.standing = Math.max(ps.standing ?? 0, 8);
  addDeed(state, content, { type: 'deed', text: `Was made ${d.title}`, weight: RULE.deed, witnesses: 1000 });
  journal(state, `Made ${d.title}.`);
  // a legend who wanted it, and didn't get it, is the smaller for it
  const r = rivalOf(state, content, seat);
  if (r.legend) (state.legends ??= {})[r.legend] = (state.legends[r.legend] ?? 0) - 20;
}

export function loseSeat(state: GameState, content: ContentBundle, why: string): string[] {
  if (!state.rule) return [];
  const seat = state.rule.seat;
  const d = ruleDef(state, content)!;
  delete state.rule;
  delete state.flags[`ru_${seat}`];
  state.flags[`ru_${seat}_lost`] = 1;
  journal(state, `Lost the seat: ${d.title} no longer.`);
  void content;
  return [why];
}

/** The turn of the year for a ruler: tribute, men, being seen, and whether a rival comes. */
export function ruleYear(state: GameState, content: ContentBundle, rng: RngCursor, wintered: string | null): string[] {
  const r = state.rule;
  if (!r) return [];
  const d = ruleDef(state, content)!;
  const year = dateOf(state.day).year;
  if (wintered === d.place) r.seen = year;
  if (year - r.seen > RULE.absent) {
    if (r.seat === 'lordship') return loseSeat(state, content, `You have not been seen at ${content.places[d.place]?.name ?? 'your land'} for ${plural(year - r.seen, 'winter')}. Its people still pay what they owe, to your steward, and have stopped calling you lord.`);
    const rv = rivalOf(state, content, r.seat);
    return loseSeat(state, content, `You have not been seen at ${content.places[d.place]!.name} for ${plural(year - r.seen, 'winter')}. ${rv.name} sits in the high seat now, and the people who were yours have stopped saying your name at the door.`);
  }
  const t = ruleTribute(state);
  state.silver += t.silver;
  earn(state, t.silver);
  state.musterPool += t.men;
  const lines = [`As ${d.title}, your tribute comes in: ${formatSilver(t.silver)}, and ${plural(t.men, 'man', 'men')} more at the muster.`];
  // the legends' years (docs/FRAME-WORLD.md §B): the Danes at Dublin in 851, Rorik's fleet in 850
  if (r.seat === 'dublin' && year === 851) state.queue.push({ scene: 'ru_danes', day: state.day });
  else if (r.seat === 'walcheren' && year === 850) state.queue.push({ scene: 'ru_rorik', day: state.day });
  // each new seat has its own troubles, one a year at most (content/scenes/world/realms.yaml)
  else if (SEAT_EVENTS[r.seat] && rng.float() < RULE.seatEvent) {
    const due = SEAT_EVENTS[r.seat]!.filter((id) => state.seen[id] === undefined);
    if (due.length) state.queue.push({ scene: due[0]!, day: state.day });
    else if (r.seat !== 'lordship' && rng.float() < RULE.challenge) state.queue.push({ scene: 'ru_challenge', day: state.day });
  }
  else if (r.seat !== 'lordship' && rng.float() < RULE.challenge) state.queue.push({ scene: 'ru_challenge', day: state.day });
  return lines;
}

/** What a seat brings in a year: a lordship, half. */
export function ruleTribute(state: GameState): { silver: number; men: number } {
  return state.rule?.seat === 'lordship' ? { silver: RULE.tribute / 2, men: RULE.men / 2 } : { silver: RULE.tribute, men: RULE.men };
}
