import { asRecord, hashString, rng, Vec } from './aesthetics';

// Turn an aesthetic vector into an actual image (an SVG). No external assets, no
// model calls — but the picture genuinely reflects the vector, so swiping on it
// produces real signal. Same vector always renders the same image.
//
// The mapping is intentionally legible: warmth/brightness/saturation set the
// palette, contrast sets the tonal spread, density sets how many shapes,
// geometry picks organic vs. angular forms, era shifts the hue, and texture
// lays on film grain.

function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360} ${Math.round(s)}% ${Math.round(l)}%)`;
}

export function renderSvg(vec: Vec, id: string): string {
  const a = asRecord(vec);
  const rand = rng(hashString(id));

  // Base hue: warm→amber/red (~30), cool→blue (~215), shifted by era toward
  // magenta/cyan for the futuristic end.
  const baseHue = a.warmth * 40 + (1 - a.warmth) * 220 + (a.era - 0.5) * 60;
  const sat = 20 + a.saturation * 70;
  const midL = 22 + a.brightness * 60;
  const spread = 8 + a.contrast * 42; // lightness spread between fg/bg

  const bgTop = hsl(baseHue - 10, sat * 0.7, midL - spread * 0.5);
  const bgBot = hsl(baseHue + 15, sat * 0.5, midL + spread * 0.5);

  const shapeCount = Math.round(1 + a.density * 13);
  const angular = a.geometry; // 0 organic .. 1 angular

  const shapes: string[] = [];
  for (let i = 0; i < shapeCount; i++) {
    const cx = rand() * 100;
    const cy = rand() * 100;
    const size = 6 + rand() * (10 + a.density * 26);
    const hue = baseHue + (rand() - 0.5) * (30 + a.saturation * 40);
    const l = midL + (rand() - 0.5) * spread * 2;
    const op = 0.35 + rand() * 0.5;
    const fill = hsl(hue, sat, Math.max(4, Math.min(96, l)));
    if (rand() < angular) {
      // Angular: rotated squares / bars.
      const w = size * (0.6 + rand() * 1.4);
      const h = size * (0.6 + rand() * 1.4);
      const rot = Math.round(rand() * 90);
      shapes.push(
        `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" opacity="${op.toFixed(2)}" transform="rotate(${rot} ${cx.toFixed(1)} ${cy.toFixed(1)})" rx="${(angular < 0.5 ? size * 0.2 : 0).toFixed(1)}"/>`,
      );
    } else {
      // Organic: soft blobs / circles.
      const rx = size * (0.7 + rand() * 0.8);
      const ry = size * (0.7 + rand() * 0.8);
      shapes.push(
        `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" opacity="${op.toFixed(2)}"/>`,
      );
    }
  }

  const grain = a.texture;
  const grainLayer =
    grain > 0.05
      ? `<rect width="100" height="100" filter="url(#grain-${cssId(id)})" opacity="${(grain * 0.5).toFixed(2)}"/>`
      : '';
  // A soft vignette scales with contrast for that filmic falloff.
  const vignette = a.contrast * 0.55;

  return `
<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="aesthetic variation">
  <defs>
    <linearGradient id="bg-${cssId(id)}" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0" stop-color="${bgTop}"/>
      <stop offset="1" stop-color="${bgBot}"/>
    </linearGradient>
    <radialGradient id="vig-${cssId(id)}" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.55" stop-color="black" stop-opacity="0"/>
      <stop offset="1" stop-color="black" stop-opacity="${vignette.toFixed(2)}"/>
    </radialGradient>
    <filter id="grain-${cssId(id)}">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="100" height="100" fill="url(#bg-${cssId(id)})"/>
  ${shapes.join('\n  ')}
  <rect width="100" height="100" fill="url(#vig-${cssId(id)})"/>
  ${grainLayer}
</svg>`.trim();
}

// SVG ids must be unique per element on the page and CSS-safe.
function cssId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}
