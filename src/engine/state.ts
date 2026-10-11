// Game state. Plain JSON: it is the save.
import type { Attr, Skill, DuelMove, Order, BattleTerrain, Phase } from '../content/schema';

export type RngState = [number, number, number, number];
export type Position = 'front' | 'wall' | 'rear';
export type Wind = 'fair' | 'slack' | 'foul' | 'gale';

export interface Wound {
  id: string; // injury registry id
  until: number; // day it heals; -1 = permanent
  from: string; // what gave it
}

export interface Hero {
  name: string;
  background: string;
  born: number;
  attrs: Record<Attr, number>;
  skills: Record<Skill, number>;
  xp: Record<Skill, number>;
  hp: number;
  wounds: Wound[];
  nickname: string | null;
  alive: boolean;
}

export interface Ship {
  id: string;
  type: string;
  name: string;
  hull: number; // 0..100
}

export interface SwornMan {
  id: string;
  name: string;
  temperament: string;
  weapons: number;
  loyalty: number; // 0..10
  alive: boolean;
  slot: Position;
  deeds: number;
  nickname: string | null;
  diedOn: number | null;
}

export interface Deed {
  n: number;
  type: string;
  day: number;
  place: string | null;
  text: string;
  weight: number;
  witnesses: number;
  told: number | null; // day last told; null = never
  verse: boolean;
}

export interface Voyage {
  from: string;
  to: string;
  kind: 'coastal' | 'open' | 'river';
  total: number; // leg length in fair-wind days
  progress: number;
  daysAtSea: number;
  wind: Wind;
}

export interface DuelSide {
  name: string;
  hp: number;
  hpMax: number;
  stamina: number;
  staminaMax: number;
  shields: number; // shields left, including the one in use
  integrity: number; // of the shield in use
  str: number;
  agi: number;
  weapons: number;
  shield: number;
  armour: number;
  weapon: number;
  habits: Partial<Record<DuelMove, number>>;
  bled: boolean;
  hits: number[]; // damage taken, hit by hit (wounds are drawn from these afterwards)
}

export interface DuelState {
  kind: 'duel' | 'holmgang';
  lethal: boolean;
  foeId: string;
  hero: DuelSide;
  foe: DuelSide;
  exchange: number;
  seen: Partial<Record<DuelMove, number>>; // the foe's moves so far
  heroSeen?: Partial<Record<DuelMove, number>>; // the hero's moves so far (skilled foes read them)
  read: DuelMove[]; // habits the hero has read
  readChance: number; // per exchange, from Wits and Cunning
  paused?: boolean; // instinct has already stopped once to offer the yield
  log: string[];
  over: null | 'won' | 'lost' | 'yielded' | 'foe_yielded' | 'parted' | 'dead';
  win?: string;
  lose?: string;
}

export interface BattleSide {
  name: string;
  men: number;
  start: number;
  quality: number;
  morale: number;
  doctrine: Partial<Record<Order, number>>;
  last: Order | null;
}

export interface BattleNamed {
  id: string;
  name: string;
  slot: Position;
  weapons: number;
  down: boolean; // dead
  hurt: boolean;
}

export interface BattleState {
  foeId: string;
  terrain: BattleTerrain;
  us: BattleSide;
  them: BattleSide;
  position: Position;
  round: number;
  log: string[];
  heroDown: boolean;
  heroHp: number;
  heroHpMax: number;
  heroArmour: number;
  heroHits: number[];
  named: BattleNamed[];
  deeds: { type: string; text: string; who: string | null }[];
  over: null | 'won' | 'lost' | 'parted';
  context: 'raid' | 'sea' | 'scene';
  place: string | null;
  win?: string;
  lose?: string;
  killed: number;
  lost: number;
}

export type Pending =
  | { t: 'scene'; id: string; result?: string }
  | { t: 'duel'; duel: DuelState }
  | { t: 'battle'; battle: BattleState }
  | { t: 'report'; title: string; lines: string[]; next?: string; art?: string; laughter?: string };

export interface PlaceState {
  wealth: number;
  defence: number; // multiplier on defenders, decays toward 1
  raided: number; // times raided
  lastRaided: number | null;
}

export interface LogEntry {
  day: number;
  text: string;
}

export interface Death {
  day: number;
  cause: 'battle' | 'wounds' | 'duel' | 'drowned' | 'straw';
  text: string;
  afterlife: 'valhalla' | 'folkvangr' | 'ran' | 'hel';
}

export interface GameState {
  v: 1;
  seed: number;
  rng: RngState;
  day: number;
  phase: Phase;
  hallLeft: number;
  hero: Hero;
  honour: number;
  hamingja: number;
  silver: number;
  loot: number;
  provisions: number; // man-days
  ships: Ship[];
  crew: { men: number; quality: number; morale: number };
  men: SwornMan[];
  at: string | null; // place, or null at sea
  voyage: Voyage | null;
  deeds: Deed[];
  flags: Record<string, number>;
  seen: Record<string, number>;
  queue: { scene: string; day: number }[];
  known: string[];
  places: Record<string, PlaceState>;
  pending: Pending | null;
  journal: LogEntry[];
  death: Death | null;
  stats: { legs: number; storms: number; battles: number; battlesWon: number; duels: number; duelsWon: number; raids: number; plunder: number; hungerDays: number };
  seasonRaids: string[];
  building: string | null; // ship type being built over the winter
  musterPool: number; // men still willing to sign on this spring
  position: Position; // where he stands in the next fight
  rearFights: number; // fights in a row fought from behind the wall
}
