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
  /** An heir's father's given name, for {father} and the patronymic (docs/FRAME-LINEAGE.md B). */
  father?: string;
}

/** A child of the house (docs/FRAME-LINEAGE.md B). */
export interface Child {
  id: string;
  name: string;
  sex: 'm' | 'f';
  /** The year of the spring after the winter he was born in: his age is counted from it. */
  born: number;
  alive: boolean;
  died?: number;
  /** The hero whose child this is (his full name then). */
  father: string;
  mother?: string;
  /** In fosterage now: "lord:<id>" or "cap:<id>", and since when. */
  foster?: { with: string; since: number };
  /** Fostered, and come home: with whom. */
  fostered?: string;
  /** At the oar: his sworn-man id. */
  man?: string;
  /** Sailed at his father's side, before he was the heir. */
  sailed?: boolean;
  /** Married into this house. */
  wed?: string;
  /** He is the hero now. */
  hero?: boolean;
}

/** A father whose saga went on as his son's. */
export interface Ancestor {
  name: string;
  nickname: string | null;
  born: number;
  died: number;
  cause: Death['cause'];
  afterlife: Death['afterlife'];
  fame: number;
  deeds: number;
  text: string;
}

export interface Ship {
  id: string;
  type: string;
  name: string;
  hull: number; // 0..100
  /** Fittings from the shipwright (FRAME-FOUNDATION §2). */
  fittings?: string[];
  /** Who has her steering-oar, if she is not the flagship: "man:<sworn id>" or "hired:<name>" (docs/FRAME-FLEET.md). */
  master?: string;
}

/** One thing he owns. A weapon counts its deeds; at enough of them, the men give it a name. */
export interface ItemInst {
  uid: string;
  id: string;
  name: string | null;
  deeds: number;
}
export type KitSlot = 'weapon' | 'shield' | 'helmet' | 'armour';

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
  sworn: boolean; // has given his oath to the hero (bench-mates have not)
  hurtUntil: number | null; // sits out fights until this day
  /** A man not in the registry, made when he came (docs/FRAME-HIRD-HOSTAGES.md): where from, and what he is like. */
  origin?: string;
  desc?: string;
}

export interface Boast {
  id: string;
  sworn: number; // day
  due: number;
  state: 'open' | 'kept' | 'broken';
  /** The count a { stat } goal is measured from. */
  base?: number;
  /** The day it was kept or broken: the Yule reckoning tells the year's. */
  closed?: number;
}

export interface Service {
  captain: string;
  route: string[]; // where the captain means to go next, in order
  shares: number; // shares of the plunder the hero has earned (1 an oarsman; 2 for a deed)
  /** Where this captain's season ends and he winters, if not the home fjord (the outlaw's captains: docs/FRAME-BEGINNINGS.md). */
  home?: string;
}

export interface PlunderState {
  place: string;
  round: number;
  alarm: number; // 0..10; at 10 the countryside arrives
  taken: number;
  captives: number;
  burned: boolean;
  log: string[];
  next?: string; // scene to open when it is over
  /** Someone worth a ransom was looked for (once a raid), and found. */
  searched?: boolean;
  hostage?: string;
  /** The dead and the hall searched for war-gear (once a raid); the stores taken (once a raid). Playtest 9. */
  armed?: boolean;
  stores?: boolean;
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
  /** Uncharted water (FRAME-FOUNDATION §1). */
  expedition?: boolean;
  /** Scenes that have broken into this leg (at most SEA_EVENTS_PER_LEG). */
  events?: number;
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
  /** Where a fight broken off with neither man beaten goes; else the win link. */
  parted?: string;
  /** The second form of single combat (docs/FRAME-COMBAT-2.md): shown intent, stamina, shields, the cloak's edge. */
  bout?: import('./bout').BoutState;
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
  /** His own skill in the wall: weapons where he stands, shield to keep the blades off, command if he leads. */
  heroSkill?: { weapons: number; shield: number; command: number; leads: boolean };
  heroHits: number[];
  named: BattleNamed[];
  deeds: { type: string; text: string; who: string | null }[];
  over: null | 'won' | 'lost' | 'parted';
  context: 'raid' | 'sea' | 'scene';
  place: string | null;
  win?: string;
  lose?: string;
  parted?: string;
  killed: number;
  lost: number;
  /** A félag partner's men in our line: his losses are his own. */
  allyMen?: number;
  /** A host: the other wings of the line (docs/FRAME-HOSTS-FRISIA.md). */
  host?: import('./host').HostState;
  /** The second form of the shield-wall (docs/FRAME-COMBAT-2.md): deployment, shown intent, stamina, ground. */
  wall?: import('./wall').WallState;
}

export type Pending =
  | { t: 'scene'; id: string; result?: string }
  | { t: 'duel'; duel: DuelState }
  | { t: 'battle'; battle: BattleState }
  | { t: 'plunder'; plunder: PlunderState }
  | { t: 'shop'; shops: ('smith' | 'market' | 'shipwright')[] }
  | { t: 'trade' }
  | { t: 'cruise' }
  /** The heir's spread and upbringing (docs/FRAME-LINEAGE.md B). */
  | { t: 'heir' }
  | { t: 'report'; title: string; lines: string[]; next?: string; art?: string; laughter?: string; then?: 'heir' };

export interface PlaceState {
  wealth: number;
  defence: number; // multiplier on defenders, decays toward 1
  raided: number; // times raided
  lastRaided: number | null;
  /** What the place thinks of him (DESIGN §11.6); absent until it first changes, then -10..10. */
  standing?: number;
  /** Men hired here this year. */
  hired?: number;
  /** The year he last asked for guest-right here. */
  guested?: number;
  /** The day he last stood his crew a round here. */
  aled?: number;
  /** He has made landfall here (its people have told him of their neighbours). */
  visited?: boolean;
  /** The year he last listened to the old sailors here. */
  listened?: number;
  /** A Norse ship-fort holds it now (docs/FRAME-IRELAND-SEINE.md): a market, men to hire, and not a place to raid. */
  norse?: boolean;
  /** Somebody else stripped it (docs/FRAME-WORLD.md §B): who, and when. */
  sacked?: { by: string; day: number };
  /** The day he last won a raid here: a ship-fort can be dug only where he has won. */
  wonOn?: number;
  /** What his scouts saw (docs/FRAME-WORLD.md §A): the day, whether they got close unseen, the raid's roll they fixed, picked men. */
  scout?: { day: number; ok: boolean; roll?: number; picked?: boolean };
  /** His own buying and selling here, pushing prices: lots (+ bought, - sold) as of a day (docs/FRAME-TRADE-ALLIES.md). */
  supply?: Record<string, { n: number; day: number }>;
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
  /** A fallen sworn man's id → the oarsman who took his bench (scenes written before the death name him instead). */
  standIns?: Record<string, string>;
  /** Goods aboard: lots, and what they cost him (docs/FRAME-TRADE-ALLIES.md). */
  cargo?: Record<string, { lots: number; cost: number }>;
  /** The year's trade news: one good dear or cheap everywhere. */
  tradeNews?: { good: string; mult: number; year: number };
  /** The shipmasters of the north, once anything has passed between them (docs/FRAME-TRADE-ALLIES.md). */
  captains?: Record<string, { rel: number; met: boolean; alive: boolean }>;
  /** The summer's félag: a sworn partner, the year, and the heap shared. */
  partner?: { id: string; year: number; loot: number };
  /** Jarl Eystein's favour, -10..10. */
  favour?: number;
  /** Hardship: envy, the year's ledger, the coasts' memory, disasters (docs/FRAME-HARDSHIP.md). */
  hard?: import('./hardship').HardState;
  /** This year's trade profit, and whether its deed has been earned. */
  tradeYear?: { year: number; profit: number; deed: boolean };
  hamingja: number;
  /** Silver, by weight, in ørtugar: shown as pounds and coins (src/engine/format.ts). */
  silver: number;
  /** Arm-rings he holds, to give or to cut up (src/engine/rings.ts). */
  rings?: Record<import('./rings').Metal, number>;
  loot: number;
  provisions: number; // man-days
  /** The day through which the crew has eaten (playtest 5: days ashore abroad were free, days at sea were not). */
  fedTo?: number;
  ships: Ship[];
  /** gear: the men's arms, 0 spears and shields .. 3 mail for every man (FRAME-FOUNDATION §2). */
  crew: { men: number; quality: number; morale: number; gear: number };
  items: ItemInst[];
  base: import('./base').BaseState;
  kit: Partial<Record<KitSlot, string>>;
  men: SwornMan[];
  at: string | null; // place, or null at sea
  voyage: Voyage | null;
  deeds: Deed[];
  flags: Record<string, number>;
  seen: Record<string, number>;
  queue: { scene: string; day: number }[];
  known: string[];
  /** Places heard of but not charted: drawn faint, reached only by an expedition. */
  rumoured: string[];
  /** The last thing bought, shown on the shop screen. */
  shopNote?: string;
  places: Record<string, PlaceState>;
  pending: Pending | null;
  journal: LogEntry[];
  death: Death | null;
  stats: { legs: number; storms: number; battles: number; battlesWon: number; duels: number; duelsWon: number; raids: number; plunder: number; hungerDays: number; /** Fights won standing in the front rank, on his feet at the end. */ frontWins: number };
  seasonRaids: string[];
  building: string | null; // ship type being built over the winter
  musterPool: number; // men still willing to sign on this spring
  position: Position; // where he stands in the next fight
  /** The day a scene put him in his place for the fight it starts: then he is not asked again. */
  placedOn?: number;
  rearFights: number; // fights in a row fought from behind the wall
  service: Service | null; // rowing in another man's ship
  boasts: Boast[];
  fates: Record<string, number>; // what will happen, rolled at the start (content/registry/fates.yaml)
  omens: Record<string, number>; // what the signs say will happen: the fate, right seven times in ten
  captives: number;
  /** The man a recruiting scene offers, while it is open. */
  cand?: SwornMan | null;
  /** Hostages held at home, and the one a hostage scene is about (docs/FRAME-HIRD-HOSTAGES.md). */
  hostages?: import('./hostages').Hostage[];
  hfocus?: string | null;
  /** The world without him (docs/FRAME-WORLD.md §B): events past, and the news. */
  chron?: import('./chronicle').ChronState;
  /** Lords (docs/FRAME-WORLD.md §C): what each thinks of him, his oath, and a second one kept secret. */
  lords?: Record<string, import('./lords').LordState>;
  oath?: import('./lords').Oath;
  oath2?: import('./lords').Oath;
  /** Land abroad (docs/FRAME-WORLD.md §D). */
  holdings?: import('./land').Holding[];
  /** The seat he rules (docs/FRAME-WORLD.md §E). */
  rule?: import('./rule').RuleState;
  /** What the legends' fame has gained or lost by what happened to them, against their curves. */
  legends?: Record<string, number>;
  /** The lords who last cast him out, for the scene that says so. */
  castBy?: string[];
  /** A course set for a far port (docs/FRAME-PACING.md): sailed leg by leg until something happens. */
  course?: string;
  /** A report held back while a scene had the stage: told when it is done. */
  after?: { title: string; lines: string[] };
  /** Raiding a coast on standing orders (docs/FRAME-PACING.md): the plan being drawn up, and the cruise under way. */
  cruisePlan?: import('./cruise').CruiseOrders;
  cruise?: import('./cruise').CruiseState;
  /** Children, and the line of fathers (docs/FRAME-LINEAGE.md B). */
  family?: import('./family').FamilyState;
  /** Where home is, once he has settled abroad (docs/FRAME-LINEAGE.md C). Absent: Hordaland. */
  homeAt?: string;
  /** The great fleet he sails with (docs/FRAME-FLEET-843.md §2). */
  fleet?: import('./sailfleet').FleetState;
  /** His skald, by name, and whether he sails this summer (playtest 8). */
  skald?: import('./skald').SkaldState;
  /** Lines an effect adds to the scene's result (what went into the hold). */
  notes?: string[];
}
