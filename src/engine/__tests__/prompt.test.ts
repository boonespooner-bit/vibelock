import { describe, expect, it } from 'vitest';
import { AXIS_KEYS, AxisKey, zeroVec } from '../aesthetics';
import { emptyProfile } from '../tasteEngine';
import { styledPrompt, synthesizeStyle } from '../prompt';
import { toPortable } from '../portable';

function profile(target: Partial<Record<AxisKey, number>>, weights: Partial<Record<AxisKey, number>>) {
  const t = zeroVec().map(() => 0.5);
  const w = zeroVec().map(() => 0);
  AXIS_KEYS.forEach((k, i) => {
    if (target[k] !== undefined) t[i] = target[k]!;
    if (weights[k] !== undefined) w[i] = weights[k]!;
  });
  return { ...emptyProfile(), target: t, weights: w, confidence: 0.8 };
}

describe('synthesizeStyle', () => {
  it('emits vocabulary only for high-weight axes', () => {
    const p = profile({ warmth: 0.95, saturation: 0.9 }, { warmth: 1, saturation: 0.1 });
    const { tags } = synthesizeStyle(p);
    expect(tags.some((t) => /warm|golden|amber/.test(t))).toBe(true);
    // saturation weight (0.1) is below threshold → no saturation vocab.
    expect(tags.some((t) => /saturat|technicolor/.test(t))).toBe(false);
  });

  it('picks the correct end of an axis', () => {
    const cool = synthesizeStyle(profile({ warmth: 0.05 }, { warmth: 1 }));
    expect(cool.clause).toMatch(/cool|cold|steely/);
    const warm = synthesizeStyle(profile({ warmth: 0.95 }, { warmth: 1 }));
    expect(warm.clause).toMatch(/warm|golden|amber/);
  });

  it('produces the pitch jargon for dark high-contrast minimal taste', () => {
    const p = profile(
      { brightness: 0.15, contrast: 0.85, density: 0.15 },
      { brightness: 1, contrast: 1, density: 0.9 },
    );
    const { clause } = synthesizeStyle(p);
    expect(clause).toMatch(/85mm/);
    expect(clause).toMatch(/volumetric/);
  });

  it('is deterministic for the same profile', () => {
    const p = profile({ warmth: 0.9, texture: 0.9 }, { warmth: 1, texture: 1 });
    expect(synthesizeStyle(p).clause).toBe(synthesizeStyle(p).clause);
  });
});

describe('styledPrompt', () => {
  it('appends the style clause to the subject', () => {
    const p = profile({ warmth: 0.95 }, { warmth: 1 });
    const out = styledPrompt(p, 'a dog walking down the street');
    expect(out.startsWith('a dog walking down the street,')).toBe(true);
    expect(out).toMatch(/warm|golden|amber/);
  });

  it('returns the bare subject when nothing is load-bearing', () => {
    const p = profile({}, {}); // all weights 0
    expect(styledPrompt(p, 'a sci-fi cityscape')).toBe('a sci-fi cityscape');
  });

  it('falls back to a default subject when empty', () => {
    const p = profile({ warmth: 0.9 }, { warmth: 1 });
    expect(styledPrompt(p, '   ').length).toBeGreaterThan(0);
  });
});

describe('toPortable', () => {
  it('produces a self-describing, round-trippable artifact', () => {
    const p = profile({ warmth: 0.9 }, { warmth: 1 });
    const eng = toPortable(p, 'Golden Hour');
    expect(eng.format).toBe('vibe-lock/taste-engine');
    expect(eng.axes).toEqual(AXIS_KEYS);
    expect(eng.target).toHaveLength(AXIS_KEYS.length);
    expect(eng.name).toBe('Golden Hour');
    expect(eng.styleClause).toMatch(/warm|golden|amber/);
    // JSON-serializable.
    expect(() => JSON.parse(JSON.stringify(eng))).not.toThrow();
  });

  it('defaults the name when blank', () => {
    expect(toPortable(profile({}, {}), '   ').name).toBe('Untitled Vibe');
  });
});
