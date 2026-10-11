// The master palette (DESIGN §19a, §19b). tools/art.ts snaps every scene image to these colours,
// and the scene renderer animates by moving pixels along the ramps built from them.
// Append only: a converted image stores colours, not indices, but reordering would change the ramps.

/** The Runestone tokens, their ramps, skin and firelight. */
export const MASTER = [
  // stone and iron, dark to light
  '#111213', '#191b1c', '#222628', '#30363a', '#434a4e', '#5a6266', '#737c80', '#8a9397', '#a9b0b1', '#c9cdca',
  // bone and light
  '#8f8574', '#b5ac97', '#e6ddc8', '#f3ecdc',
  // rune red
  '#3d1410', '#6b2018', '#8f2a1f', '#b3352a', '#d0573a',
  // ochre and fire
  '#7a4a1c', '#a8692a', '#c8913a', '#e3b558', '#f0d79a',
  // firelight oranges, so hearths stay amber rather than red
  '#b8582a', '#e08a3c',
  // wood, turf and earth
  '#1e1611', '#2a1e16', '#3a2a1e', '#5b4330', '#7d5e3f', '#9c7a55',
  // sea and sky
  '#141f26', '#1c2a33', '#24343d', '#34495a', '#4d6773', '#6c8794', '#93abb5', '#bcd0d6',
  // moss, grass and lichen
  '#2b3122', '#3f4a2c', '#5c6a3a', '#8a9860', '#a9b47a',
  // skin
  '#5e3f30', '#9a6e56', '#c79a7a', '#e0bfa0',
  // dusk
  '#c97a6a', '#7a5566',
] as const;
