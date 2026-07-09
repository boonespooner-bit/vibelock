import { AXIS_KEYS, clamp01, DIM, rng, Vec, zeroVec } from './aesthetics';

// A single card the user swipes on.
export interface Variation {
  id: string;
  vec: Vec;
  seedIndex: number; // which mood-board seed it was spun from
}

// A mood-board item. In the real product this is a photo/clip the user drops in;
// we reduce it to its aesthetic vector. The starter presets below give the same
// thing without needing uploads.
export interface MoodItem {
  id: string;
  label: string;
  emoji: string;
  vec: Vec;
  // Present for uploaded images: a small data: URL thumbnail to display.
  thumb?: string;
}

// A mood board is just a named set of items, whether preset or user-uploaded.
export interface Board {
  id: string;
  name: string;
  items: MoodItem[];
}

function v(partial: Partial<Record<(typeof AXIS_KEYS)[number], number>>): Vec {
  const out = zeroVec();
  AXIS_KEYS.forEach((k, i) => {
    out[i] = partial[k] ?? 0.5;
  });
  return out;
}

// Starter mood boards — the "dump a messy mood board" step, pre-baked so the
// app is playable with zero assets. Each is a deliberately varied cluster so
// there is real signal to learn from.
export const PRESET_BOARDS: { id: string; name: string; blurb: string; items: MoodItem[] }[] = [
  {
    id: 'sunbleached',
    name: 'Sun-bleached Super 8',
    blurb: 'Warm, grainy, nostalgic — like a summer someone half-remembers.',
    items: [
      { id: 's1', label: 'golden hour', emoji: '🌅', vec: v({ warmth: 0.9, brightness: 0.7, saturation: 0.55, contrast: 0.4, texture: 0.85, geometry: 0.25, density: 0.4, era: 0.1 }) },
      { id: 's2', label: 'faded polaroid', emoji: '📸', vec: v({ warmth: 0.75, brightness: 0.6, saturation: 0.35, contrast: 0.3, texture: 0.9, geometry: 0.3, density: 0.35, era: 0.15 }) },
      { id: 's3', label: 'dusty road', emoji: '🛣️', vec: v({ warmth: 0.8, brightness: 0.55, saturation: 0.4, contrast: 0.45, texture: 0.7, geometry: 0.4, density: 0.5, era: 0.2 }) },
    ],
  },
  {
    id: 'neonnoir',
    name: 'Neon Noir',
    blurb: 'Rain-slick, high-contrast, electric. Blade Runner alley energy.',
    items: [
      { id: 'n1', label: 'wet neon', emoji: '🌃', vec: v({ warmth: 0.35, brightness: 0.2, saturation: 0.85, contrast: 0.85, texture: 0.4, geometry: 0.7, density: 0.75, era: 0.85 }) },
      { id: 'n2', label: 'cyan glow', emoji: '💠', vec: v({ warmth: 0.2, brightness: 0.25, saturation: 0.9, contrast: 0.8, texture: 0.3, geometry: 0.75, density: 0.6, era: 0.9 }) },
      { id: 'n3', label: 'chrome & smoke', emoji: '🏙️', vec: v({ warmth: 0.4, brightness: 0.15, saturation: 0.7, contrast: 0.9, texture: 0.45, geometry: 0.8, density: 0.8, era: 0.8 }) },
    ],
  },
  {
    id: 'quietluxe',
    name: 'Quiet Luxe',
    blurb: 'Minimal, soft, expensive-feeling. Lots of negative space.',
    items: [
      { id: 'q1', label: 'linen & light', emoji: '🕊️', vec: v({ warmth: 0.55, brightness: 0.85, saturation: 0.2, contrast: 0.25, texture: 0.35, geometry: 0.4, density: 0.15, era: 0.5 }) },
      { id: 'q2', label: 'matte stone', emoji: '🪨', vec: v({ warmth: 0.45, brightness: 0.7, saturation: 0.15, contrast: 0.3, texture: 0.3, geometry: 0.55, density: 0.2, era: 0.5 }) },
      { id: 'q3', label: 'soft studio', emoji: '⬜', vec: v({ warmth: 0.5, brightness: 0.9, saturation: 0.18, contrast: 0.2, texture: 0.25, geometry: 0.6, density: 0.1, era: 0.55 }) },
    ],
  },
];

// Perturb a seed vector by `spread`. Every few cards we crank the spread up so
// the deck keeps offering genuinely different options instead of converging too
// early — this is what keeps swiping informative.
function perturb(seed: Vec, spread: number, rand: () => number): Vec {
  const out = seed.slice();
  for (let i = 0; i < DIM; i++) {
    // Triangular-ish noise: sum of two uniforms, centered.
    const noise = (rand() + rand() - 1) * spread;
    out[i] = clamp01(seed[i] + noise);
  }
  return out;
}

export function centroid(vecs: Vec[]): Vec {
  const out = zeroVec();
  if (vecs.length === 0) return out;
  for (const vec of vecs) for (let i = 0; i < DIM; i++) out[i] += vec[i];
  for (let i = 0; i < DIM; i++) out[i] /= vecs.length;
  return out;
}

// Generate `count` micro-variations from a mood board. Cards are spun off
// individual seeds (so they inherit the board's character) but with escalating
// spread, plus the occasional wildcard for exploration.
export function generateVariations(
  board: MoodItem[],
  count: number,
  seed: number,
): Variation[] {
  const rand = rng(seed);
  const seeds = board.map((b) => b.vec);
  const base = seeds.length ? seeds : [zeroVec().map(() => 0.5)];
  const out: Variation[] = [];
  for (let i = 0; i < count; i++) {
    const seedIndex = i % base.length;
    // Spread grows from tight (0.12) to wide (0.5) across the deck, with an
    // occasional full wildcard.
    const wildcard = rand() < 0.15;
    const spread = wildcard ? 0.75 : 0.12 + 0.38 * (i / Math.max(1, count - 1));
    const from = wildcard ? zeroVec().map(() => 0.5) : base[seedIndex];
    out.push({
      id: `var-${seed}-${i}`,
      vec: perturb(from, spread, rand),
      seedIndex,
    });
  }
  return out;
}
