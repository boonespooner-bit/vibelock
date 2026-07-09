// The aesthetic feature space.
//
// Every image/variation in Vibe-Lock is a point in this space. The user never
// sees these numbers — they just swipe. The Taste Engine's whole job is to
// figure out *which* of these axes the user actually cares about and *where*
// on each axis their taste lives, then translate that back into language a
// generative model understands. That translation is the "Articulation Gap"
// bridge from the pitch.

export interface AxisDef {
  key: AxisKey;
  label: string;
  // Human words for the low (0) and high (1) ends of the axis. Used both in
  // the UI ("you lean warm") and in prompt synthesis.
  low: string;
  high: string;
}

export type AxisKey =
  | 'warmth'
  | 'brightness'
  | 'saturation'
  | 'contrast'
  | 'texture'
  | 'geometry'
  | 'density'
  | 'era';

// Ordered — the order is stable so a taste vector can be serialized as a plain
// array and stay meaningful across sessions/exports.
export const AXES: readonly AxisDef[] = [
  { key: 'warmth', label: 'Temperature', low: 'cool', high: 'warm' },
  { key: 'brightness', label: 'Light', low: 'dark & moody', high: 'bright & airy' },
  { key: 'saturation', label: 'Saturation', low: 'muted', high: 'vivid' },
  { key: 'contrast', label: 'Contrast', low: 'soft', high: 'punchy' },
  { key: 'texture', label: 'Texture', low: 'clean digital', high: 'filmic grain' },
  { key: 'geometry', label: 'Form', low: 'organic', high: 'geometric' },
  { key: 'density', label: 'Density', low: 'minimal', high: 'maximal' },
  { key: 'era', label: 'Era', low: 'analog / retro', high: 'futuristic' },
] as const;

export const AXIS_KEYS: readonly AxisKey[] = AXES.map((a) => a.key);
export const DIM = AXES.length;

// A taste vector is one value in [0,1] per axis, indexed by AXIS_KEYS order.
export type Vec = number[];

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function zeroVec(): Vec {
  return new Array(DIM).fill(0);
}

export function asRecord(v: Vec): Record<AxisKey, number> {
  const out = {} as Record<AxisKey, number>;
  AXIS_KEYS.forEach((k, i) => (out[k] = v[i]));
  return out;
}

// Deterministic, seedable PRNG (mulberry32) so variations are reproducible.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
