// The contract between a narrative game and the text tools in this folder (lint-style,
// render-scan, continuity, audit-choices). Each game writes one file, tools/narrative.adapter.ts,
// that exports `adapter` satisfying NarrativeAdapter. The tools never import the game's code
// directly, so the same four tools run on a game built on the shared engine (packages/engine)
// and on one with an engine of its own (Vikingr).
//
// Copied from the game-narrative skill (tools/). Do not edit per game: fix it in the skill.

/** One player-facing string as written in the content, before rendering. */
export interface Written { where: string; text: string }

/** One rendered string a player saw. scene: the scene it belongs to (an outcome belongs to the scene it was chosen in). */
export interface Seen { kind: 'text' | 'title' | 'outcome' | 'choice' | 'other'; scene: string; text: string }

/** What a played run showed at one step. */
export interface Observed<S = unknown> { state: S; scene: string; texts: Seen[] }

/** A scene as audit-choices reads it. Pass the whole scene object (spread, plus group): flags its text
 *  or conditions read count as reads, so a scene cut down to its choices under-reports them. */
export interface AuditScene {
  id: string;
  /** chapter, part or file: the group the audit tallies by */
  group: string;
  choices: AuditChoice[];
}
export interface AuditChoice {
  id: string;
  text: string;
  effects?: unknown[];
  next?: unknown;
  check?: unknown;
  /** checked outcomes: success, partial, failure (each { effects, next, text }) */
  [outcome: string]: unknown;
}

export interface NarrativeAdapter<C = unknown, S = unknown> {
  /** the game's name, for headers */
  name: string;
  /** the compiled content, loaded once per tool run */
  load(): C;
  /** path to the style guide with the ```banned and ```watch fences */
  styleGuide: string;
  /** every player-facing string, as written (lint-style reads these) */
  textsOf(content: C): Written[];
  /** play `runs` runs per start (bots, any policy); call observe for every rendered step (render-scan, continuity) */
  play(content: C, runs: number, observe: (o: Observed<S>) => void): void;
  /** the scenes and their choices (audit-choices) */
  scenes(content: C): AuditScene[];
  /** content outside scenes whose conditions also read flags and counters (registries: a captain's bias, an event table) */
  readsFrom?(content: C): unknown[];
  /** keys in a scene object whose strings are text (their {flag.x} mentions are flavour, not mechanics) */
  textKeys?: string[];
  /** continuity: the game's condition grammar, for the rules in continuityFile */
  cond?: {
    validate(src: unknown, content: C): string[];
    test(src: unknown, state: S, content: C): boolean;
  };
  /** YAML phrase rules (continuity): a list, or { rules: [...], dead_names_ok: { scene: [names] } } */
  continuityFile?: string;
  /** the group (chapter) a scene belongs to, for rules limited with `chapters:` */
  groupOf?(content: C, scene: string): string | undefined;
  /** the people dead in this state: an id (for dead_names_ok) and the names text would use ("Sir Hamon", "Hamon Darrell") */
  dead?(state: S, content: C): { id: string; names: string[] }[];
}

/** Tool arguments: --runs=N --strict --list --group=x */
export function args(): { runs?: number; strict: boolean; list: boolean; group?: string; [k: string]: unknown } {
  const out: Record<string, unknown> = { strict: false, list: false };
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]!] = m[2] === undefined ? true : /^\d+$/.test(m[2]) ? Number(m[2]) : m[2];
  }
  return out as never;
}

/** Sentences of a passage, for rules that judge one sentence at a time. */
export const sentences = (t: string) => t.split(/(?<=[.!?]["”’]?)\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** Load the game's adapter (tools/narrative.adapter.ts, beside this folder). */
export async function loadAdapter(): Promise<NarrativeAdapter> {
  const mod = await import('../narrative.adapter');
  return (mod as { adapter: NarrativeAdapter }).adapter;
}
