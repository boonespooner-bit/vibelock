import { AXIS_KEYS, clamp01, Vec, zeroVec } from './aesthetics';

// Turn an uploaded image into an aesthetic vector — the same 8-axis space the
// rest of the engine speaks (aesthetics.ts). This is deliberately a real,
// transparent pixel analysis that runs entirely in the browser: free, instant,
// private, and unaffected by any API quota. It's a stand-in for what a vision
// model would infer, but you can read exactly how each number is derived.
//
// analyzePixels is a pure function (RGBA bytes -> Vec) so it can be unit-tested
// without a DOM; analyzeImageFile wraps it with canvas plumbing.

function set(v: Vec, key: (typeof AXIS_KEYS)[number], value: number) {
  v[AXIS_KEYS.indexOf(key)] = clamp01(value);
}

export function analyzePixels(data: Uint8ClampedArray, w: number, h: number): Vec {
  const n = w * h;
  const out = zeroVec();
  if (n === 0) return out.map(() => 0.5);

  const lum = new Float64Array(n);
  let sumR = 0;
  let sumB = 0;
  let sumSat = 0;
  let sumLum = 0;

  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lum[i] = l;
    sumLum += l;
    sumR += r;
    sumB += b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    sumSat += max === 0 ? 0 : (max - min) / max;
  }

  const avgR = sumR / n;
  const avgB = sumB / n;
  const meanLum = sumLum / n;

  // Contrast: spread of luminance.
  let varLum = 0;
  for (let i = 0; i < n; i++) varLum += (lum[i] - meanLum) ** 2;
  const stdLum = Math.sqrt(varLum / n);

  // Texture (grain/detail): mean high-frequency energy — how much neighboring
  // pixels differ. Smooth gradients read low; grain/detail reads high.
  let hf = 0;
  let hfCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      hf += Math.abs(lum[y * w + x] - lum[y * w + x + 1]);
      hfCount++;
    }
  }
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      hf += Math.abs(lum[y * w + x] - lum[(y + 1) * w + x]);
      hfCount++;
    }
  }
  const hfEnergy = hfCount ? hf / hfCount : 0;

  // Box-blur luminance to separate *coherent structure* from *fine grain*.
  // Grain vanishes under a 3x3 average, so edges found on the blurred image
  // reflect real composition — this keeps grain in "texture" and out of
  // "density".
  const lumB = new Float64Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += lum[yy * w + xx];
          c++;
        }
      }
      lumB[y * w + x] = s / c;
    }
  }

  // Edges via Sobel on the blurred luminance — drives density (how much strong
  // structure there is) and geometry (axis-aligned/architectural vs diagonal).
  const EDGE_THRESHOLD = 90;
  let edgeCount = 0;
  let alignSum = 0;
  const at = (x: number, y: number) => lumB[y * w + x];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const gy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      const mag = Math.hypot(gx, gy);
      if (mag > EDGE_THRESHOLD) {
        edgeCount++;
        // 1 => edge is purely horizontal or vertical (axis-aligned); 0.5 => 45°.
        alignSum += Math.max(Math.abs(gx), Math.abs(gy)) / (Math.abs(gx) + Math.abs(gy) + 1e-6);
      }
    }
  }
  const interior = Math.max(1, (w - 2) * (h - 2));
  const edgeFrac = edgeCount / interior;
  const avgAlign = edgeCount ? alignSum / edgeCount : 0.7;

  const brightness = meanLum / 255;
  const warmth = 0.5 + ((avgR - avgB) / 255) * 1.4;
  const saturation = sumSat / n;
  const contrast = stdLum / 70;
  const texture = hfEnergy / 22;
  // Density is coherent structure only (grain was blurred out above), so a
  // grainy-but-simple frame reads as textured, not busy.
  const density = edgeFrac / 0.28;
  // avgAlign lives roughly in [0.5, 1]; stretch that into a full 0..1 geometry.
  const geometry = (avgAlign - 0.62) / 0.3;
  // Era is the softest axis to read from pixels alone, so we derive it from a
  // blend: cool + saturated + clean trends futuristic; warm + grainy trends
  // retro/analog.
  const era =
    0.5 + 0.35 * (saturation - 0.5) + 0.3 * (0.5 - clamp01(warmth)) + 0.25 * (0.5 - clamp01(texture));

  set(out, 'warmth', warmth);
  set(out, 'brightness', brightness);
  set(out, 'saturation', saturation);
  set(out, 'contrast', contrast);
  set(out, 'texture', texture);
  set(out, 'geometry', geometry);
  set(out, 'density', density);
  set(out, 'era', era);
  return out;
}

export interface AnalyzedImage {
  vec: Vec;
  thumb: string; // small data: URL for display
}

// Browser-only: decode a File, analyze it at low resolution, and produce a
// compact thumbnail for the mood-board UI.
export async function analyzeImageFile(file: File): Promise<AnalyzedImage> {
  const bitmap = await fileToImage(file);
  // Analyze at a moderately high resolution: too small and fine texture/grain
  // gets smoothed away before we can measure it.
  const vec = analyzeDrawn(bitmap, 168);
  const thumb = toThumb(bitmap, 320);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
  return { vec, thumb };
}

type Drawable = HTMLImageElement | ImageBitmap;

async function fileToImage(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decode */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fit(src: Drawable, maxSide: number): { w: number; h: number } {
  const sw = (src as HTMLImageElement).naturalWidth || (src as ImageBitmap).width;
  const sh = (src as HTMLImageElement).naturalHeight || (src as ImageBitmap).height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  return { w: Math.max(1, Math.round(sw * scale)), h: Math.max(1, Math.round(sh * scale)) };
}

function analyzeDrawn(src: Drawable, maxSide: number): Vec {
  const { w, h } = fit(src, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return analyzePixels(data, w, h);
}

function toThumb(src: Drawable, maxSide: number): string {
  const { w, h } = fit(src, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
}
