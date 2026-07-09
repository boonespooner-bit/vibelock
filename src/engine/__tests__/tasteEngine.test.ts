import { describe, expect, it } from 'vitest';
import { AXIS_KEYS, AxisKey, zeroVec } from '../aesthetics';
import {
  affinity,
  applyLock,
  computeConfidence,
  dominantAxes,
  distance,
  emptyProfile,
  learn,
  rank,
  Swipe,
} from '../tasteEngine';

function vec(partial: Partial<Record<AxisKey, number>>, fill = 0.5): number[] {
  const v = zeroVec().map(() => fill);
  AXIS_KEYS.forEach((k, i) => {
    if (partial[k] !== undefined) v[i] = partial[k]!;
  });
  return v;
}

const idx = (k: AxisKey) => AXIS_KEYS.indexOf(k);

describe('learn', () => {
  it('returns a neutral-ish profile with no likes', () => {
    const p = learn([{ vec: vec({}), liked: false }]);
    expect(p.likes).toBe(0);
    expect(p.confidence).toBeLessThan(0.4);
  });

  it('weights the axis that separates likes from dislikes highest', () => {
    // Likes are consistently warm, dislikes consistently cool; every other axis
    // is identical noise on both sides, so warmth should dominate.
    const swipes: Swipe[] = [
      { vec: vec({ warmth: 0.9, brightness: 0.5 }), liked: true },
      { vec: vec({ warmth: 0.85, brightness: 0.5 }), liked: true },
      { vec: vec({ warmth: 0.92, brightness: 0.5 }), liked: true },
      { vec: vec({ warmth: 0.1, brightness: 0.5 }), liked: false },
      { vec: vec({ warmth: 0.15, brightness: 0.5 }), liked: false },
      { vec: vec({ warmth: 0.08, brightness: 0.5 }), liked: false },
    ];
    const p = learn(swipes);
    const dom = dominantAxes(p, 1)[0];
    expect(dom.key).toBe('warmth');
    // Warmth weight is the normalized max → ~1.
    expect(p.weights[idx('warmth')]).toBeCloseTo(1, 5);
    // An axis with no separation and no spread should be far lower.
    expect(p.weights[idx('brightness')]).toBeLessThan(0.5);
  });

  it('places the target near the liked centroid, nudged away from dislikes', () => {
    const swipes: Swipe[] = [
      { vec: vec({ warmth: 0.8 }), liked: true },
      { vec: vec({ warmth: 0.8 }), liked: true },
      { vec: vec({ warmth: 0.2 }), liked: false },
      { vec: vec({ warmth: 0.2 }), liked: false },
    ];
    const p = learn(swipes);
    const t = p.target[idx('warmth')];
    // At or above the liked mean (pushed further from the cool dislikes), capped.
    expect(t).toBeGreaterThanOrEqual(0.8);
    expect(t).toBeLessThanOrEqual(1);
  });

  it('does not over-weight an axis where likes are internally scattered', () => {
    // Likes span the full warmth range → inconsistent → should not be trusted,
    // even though the mean happens to differ from dislikes.
    const swipes: Swipe[] = [
      { vec: vec({ warmth: 0.0, saturation: 0.9 }), liked: true },
      { vec: vec({ warmth: 1.0, saturation: 0.9 }), liked: true },
      { vec: vec({ warmth: 0.5, saturation: 0.9 }), liked: true },
      { vec: vec({ warmth: 0.5, saturation: 0.1 }), liked: false },
      { vec: vec({ warmth: 0.5, saturation: 0.1 }), liked: false },
      { vec: vec({ warmth: 0.5, saturation: 0.1 }), liked: false },
    ];
    const p = learn(swipes);
    // Saturation cleanly separates and is consistent → should beat scattered warmth.
    expect(p.weights[idx('saturation')]).toBeGreaterThan(p.weights[idx('warmth')]);
  });
});

describe('confidence', () => {
  it('stays low until there are both likes and dislikes', () => {
    expect(computeConfidence(5, 0, zeroVec().map(() => 1))).toBeLessThanOrEqual(0.35);
    expect(computeConfidence(0, 5, zeroVec().map(() => 1))).toBeLessThanOrEqual(0.35);
  });

  it('rises with more balanced evidence', () => {
    const w = zeroVec().map(() => 0.8);
    const few = computeConfidence(2, 2, w);
    const many = computeConfidence(12, 10, w);
    expect(many).toBeGreaterThan(few);
    expect(many).toBeLessThanOrEqual(1);
  });
});

describe('distance / affinity / rank', () => {
  const profile = { ...emptyProfile(), target: vec({ warmth: 0.9 }), weights: vec({ warmth: 1 }, 0) };

  it('affinity is highest at the target', () => {
    const onVibe = affinity(profile, vec({ warmth: 0.9 }));
    const offVibe = affinity(profile, vec({ warmth: 0.1 }));
    expect(onVibe).toBeGreaterThan(offVibe);
    expect(onVibe).toBeCloseTo(1, 5);
  });

  it('ignores axes with zero weight', () => {
    // brightness differs wildly but has zero weight → distance unaffected.
    const d1 = distance(profile, vec({ warmth: 0.9, brightness: 0.0 }));
    const d2 = distance(profile, vec({ warmth: 0.9, brightness: 1.0 }));
    expect(d1).toBeCloseTo(d2, 6);
  });

  it('rank orders candidates best-first', () => {
    const cands = [
      { vec: vec({ warmth: 0.1 }) },
      { vec: vec({ warmth: 0.9 }) },
      { vec: vec({ warmth: 0.5 }) },
    ];
    const ranked = rank(profile, cands);
    expect(ranked[0].vec[idx('warmth')]).toBe(0.9);
    expect(ranked[2].vec[idx('warmth')]).toBe(0.1);
  });
});

describe('applyLock', () => {
  const profile = { ...emptyProfile(), target: vec({ warmth: 1, brightness: 0 }), weights: vec({ warmth: 1, brightness: 0 }) };

  it('pulls high-weight axes toward the target and leaves zero-weight axes alone', () => {
    const raw = vec({ warmth: 0.0, brightness: 0.9 });
    const out = applyLock(profile, raw, 1);
    // warmth (weight 1) gets pulled fully to target 1.
    expect(out[idx('warmth')]).toBeCloseTo(1, 5);
    // brightness (weight 0) untouched.
    expect(out[idx('brightness')]).toBeCloseTo(0.9, 5);
  });

  it('respects strength scaling', () => {
    const raw = vec({ warmth: 0.0 });
    const half = applyLock(profile, raw, 0.5);
    expect(half[idx('warmth')]).toBeCloseTo(0.5, 5);
  });
});
