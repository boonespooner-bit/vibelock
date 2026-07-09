import { describe, expect, it } from 'vitest';
import { analyzePixels } from '../analyze';
import { AXIS_KEYS, AxisKey } from '../aesthetics';
import { profileFromVectors } from '../tasteEngine';

const idx = (k: AxisKey) => AXIS_KEYS.indexOf(k);

// Build a w*h RGBA buffer from a per-pixel color function.
function image(w: number, h: number, fn: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

const solid = (r: number, g: number, b: number) => (_x: number, _y: number): [number, number, number] => [r, g, b];

describe('analyzePixels — color', () => {
  it('reads a bright near-white fill as bright, unsaturated, low-contrast', () => {
    const v = analyzePixels(image(32, 32, solid(245, 245, 245)), 32, 32);
    expect(v[idx('brightness')]).toBeGreaterThan(0.9);
    expect(v[idx('saturation')]).toBeLessThan(0.1);
    expect(v[idx('contrast')]).toBeLessThan(0.1);
    expect(v[idx('texture')]).toBeLessThan(0.1);
  });

  it('reads black as dark', () => {
    const v = analyzePixels(image(32, 32, solid(0, 0, 0)), 32, 32);
    expect(v[idx('brightness')]).toBeLessThan(0.05);
  });

  it('reads a red fill as warm and saturated, blue as cool', () => {
    const red = analyzePixels(image(32, 32, solid(220, 40, 40)), 32, 32);
    const blue = analyzePixels(image(32, 32, solid(40, 40, 220)), 32, 32);
    expect(red[idx('warmth')]).toBeGreaterThan(0.7);
    expect(blue[idx('warmth')]).toBeLessThan(0.3);
    expect(red[idx('saturation')]).toBeGreaterThan(0.6);
    expect(red[idx('warmth')]).toBeGreaterThan(blue[idx('warmth')]);
  });
});

describe('analyzePixels — structure', () => {
  const checker = (x: number, y: number): [number, number, number] =>
    (x + y) % 2 === 0 ? [255, 255, 255] : [0, 0, 0];
  const smoothGradient = (x: number, _y: number): [number, number, number] => {
    const c = Math.round((x / 31) * 255);
    return [c, c, c];
  };

  // A fine checkerboard is grain-like: high contrast and high texture, but NOT
  // compositional density (it's blurred out before edge detection).
  it('reads a fine checkerboard as high contrast and high texture', () => {
    const v = analyzePixels(image(32, 32, checker), 32, 32);
    expect(v[idx('contrast')]).toBeGreaterThan(0.8);
    expect(v[idx('texture')]).toBeGreaterThan(0.8);
  });

  it('reads coarse blocky structure as dense', () => {
    const blocks = (x: number, y: number): [number, number, number] =>
      (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? [255, 255, 255] : [0, 0, 0];
    const v = analyzePixels(image(64, 64, blocks), 64, 64);
    expect(v[idx('density')]).toBeGreaterThan(0.4);
  });

  it('reads a smooth gradient as low texture', () => {
    const v = analyzePixels(image(32, 32, smoothGradient), 32, 32);
    expect(v[idx('texture')]).toBeLessThan(0.2);
  });

  it('reads axis-aligned stripes as more geometric than diagonal stripes', () => {
    const stripe = (period: number, diagonal: boolean) => (x: number, y: number): [number, number, number] => {
      const t = diagonal ? x + y : x;
      return Math.floor(t / period) % 2 ? [255, 255, 255] : [0, 0, 0];
    };
    const vertical = analyzePixels(image(48, 48, stripe(6, false)), 48, 48);
    const diagonal = analyzePixels(image(48, 48, stripe(6, true)), 48, 48);
    expect(vertical[idx('geometry')]).toBeGreaterThan(diagonal[idx('geometry')]);
  });

  it('is robust to an empty image', () => {
    const v = analyzePixels(new Uint8ClampedArray(0), 0, 0);
    expect(v).toHaveLength(AXIS_KEYS.length);
    expect(v.every((n) => n >= 0 && n <= 1)).toBe(true);
  });
});

describe('profileFromVectors', () => {
  it('weights axes the images agree on and down-weights ones they vary on', () => {
    // All warm (0.9), but density varies wildly.
    const vecs = [
      set({ warmth: 0.9, density: 0.1 }),
      set({ warmth: 0.9, density: 0.9 }),
      set({ warmth: 0.9, density: 0.5 }),
    ];
    const p = profileFromVectors(vecs);
    expect(p.weights[idx('warmth')]).toBeGreaterThan(p.weights[idx('density')]);
    expect(p.target[idx('warmth')]).toBeCloseTo(0.9, 5);
  });

  it('confidence rises with more, more-consistent images', () => {
    const consistent = [set({ warmth: 0.8 }), set({ warmth: 0.8 }), set({ warmth: 0.8 }), set({ warmth: 0.8 })];
    const scattered = [set({ warmth: 0.1 }), set({ warmth: 0.9 })];
    expect(profileFromVectors(consistent).confidence).toBeGreaterThan(profileFromVectors(scattered).confidence);
  });

  it('handles a single image without crashing', () => {
    const p = profileFromVectors([set({ warmth: 0.7 })]);
    expect(p.likes).toBe(1);
    expect(p.target[idx('warmth')]).toBeCloseTo(0.7, 5);
  });
});

function set(partial: Partial<Record<AxisKey, number>>): number[] {
  const v = AXIS_KEYS.map(() => 0.5);
  AXIS_KEYS.forEach((k, i) => {
    if (partial[k] !== undefined) v[i] = partial[k]!;
  });
  return v;
}
