// Every tunable number lives here, apart from content data. All provisional
// until the measurement harnesses (tools/measure-*.ts, tools/bot.ts) say otherwise.

export const START_YEAR = 830;
export const BIRTH_YEAR = 814;

// ---- calendar (day 0 = 1 January 830, 365-day years) ----
export const YEAR_DAYS = 365;
export const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const;
export const MUSTER_DOY = 59; // 1 March
export const SAILING_DOY = 120; // 1 May: the normal start of the sailing season
export const LATE_SEASON_DOY = 243; // 1 September: may end the season at home
export const FORCE_RETURN_DOY = 288; // 15 October: at home on or after this, the season ends
export const WINTER_DOY = 304; // 1 November
export const HALL_ACTIONS = 5;
export const HALL_ACTION_DAYS = 24;

// ---- silver: stored in ørtugar. 3 ørtugar = 1 eyrir, 8 aurar = 1 mark ----
export const ORTUG_PER_EYRIR = 3;
export const ORTUG_PER_MARK = 24;

// ---- sailing ----
/** Daily storm chance by month (Jan..Dec). */
export const STORM_BY_MONTH = [0.18, 0.16, 0.08, 0.04, 0.012, 0.008, 0.01, 0.018, 0.04, 0.09, 0.15, 0.18] as const;
export const STORM_LEG_MULT = { coastal: 0.8, open: 1.5, river: 0.2 } as const;
export const WIND = {
  states: ['fair', 'slack', 'foul', 'gale'] as const,
  weights: [0.45, 0.3, 0.2, 0.05],
  progress: { fair: 1.0, slack: 0.55, foul: 0.25, gale: 0 },
  persist: 0.6,
  galeStormMult: 3,
} as const;
export const PROVISION_ORTUG_PER = 20; // man-days of food per ørtug
export const HUNGER_MORALE_PER_DAY = 0.5;

// ---- crew ----
export const SIGN_ON_GIFT = 3; // ørtugar per recruit
export const SHARE_EXPECTED = 24; // ørtugar a man hopes to take home from a season
export const LEADER_SHARE = { generous: 0.15, fair: 0.3, mean: 0.5 } as const;
export const QUALITY_MULT = [0.7, 1.0, 1.35, 1.7] as const; // green, blooded, veteran, picked men
/** Blows taken, by quality: seasoned men keep their shields up. */
export const QUALITY_GUARD = [1.15, 1.0, 0.85, 0.7] as const;

// ---- fame ----
export const FAME_FADE_DAYS = 730; // untold or long-untold deeds start to fade after two years
export const FAME_FADE_PER_YEAR = 0.5;
export const VERSE_LASTING_MULT = 1.5;
export const POSITION_FAME = { front: 1.5, wall: 1.0, rear: 0.5 } as const;

// ---- hero ----
export const HP_BASE = 10;
export const HP_PER_END = 2;
export const STAMINA_BASE = 6;
export const STRAW_DEATH_AGE = 50;
export const STRAW_DEATH_PER_YEAR = 0.025; // per year over the age, per year lived
export const SKILL_XP_PER_LEVEL = 10; // xp to the next level is this × (level + 1)

// ---- duel ----
export const DUEL = {
  maxExchanges: 30,
  cost: { strike: 2, guard: -2, feint: 1 },
  baseQuality: 0.7,
  skillStep: 0.06,
  agiStep: 0.03,
  qualityMin: 0.35,
  qualityMax: 0.95,
  exhaustedPenalty: 0.2,
  shieldIntegrity: 4,
  holmgangShields: 3,
  holmgangShieldIntegrity: 3,
  noShieldGuard: 0.5, // chance a parry with the blade alone still beats a strike
  lethalDeathChance: 0.5,
  holmlausnMarks: 3,
} as const;

// ---- battle ----
export const BATTLE = {
  maxRounds: 10,
  k: 0.05,
  matchupStep: 0.4,
  breakMorale: 2,
  breakStrength: 0.3,
  routPursuit: 0.15,
  moraleFromLosses: 12,
  moraleFromMatchup: 0.5,
  giveGroundMorale: 0.3,
  heroHit: { front: 0.16, wall: 0.07, rear: 0.015 },
  heroPower: { front: 1.1, wall: 1.0, rear: 0.95 },
  heroMoraleLoss: { front: 0.85, wall: 0.9, rear: 1.0 },
  manHit: { front: 0.06, wall: 0.03, rear: 0.01 },
  manHitDeath: 0.4,
  heroDownMorale: 2,
  flankRatio: 1.3,
} as const;
