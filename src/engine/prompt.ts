import { AXIS_KEYS, AxisKey } from './aesthetics';
import { dominantAxes, TasteProfile } from './tasteEngine';

// The Articulation Gap bridge.
//
// The user has taste but can't (and shouldn't have to) say "85mm lens,
// volumetric lighting." They swiped. This module turns the locked profile back
// into the concrete generative-model vocabulary they were missing — but only
// for the axes they actually cared about (high weight), and only phrasing the
// end they landed on. That's the whole pitch, made literal.

type Band = { max: number; phrases: string[] };
// For each axis, phrasing for the low end, the middle (usually silence — a
// neutral value isn't worth spending prompt tokens on), and the high end.
const VOCAB: Record<AxisKey, Band[]> = {
  // Middle bands are intentionally empty: a near-neutral value on an axis isn't
  // worth spending prompt words on, so we only speak up for a clear lean.
  warmth: [
    { max: 0.33, phrases: ['cool blue tones', 'steely cold color grade'] },
    { max: 0.66, phrases: [] },
    { max: 1.0, phrases: ['warm golden tones', 'amber sunlit color grade'] },
  ],
  brightness: [
    { max: 0.33, phrases: ['low-key lighting', 'deep shadows', 'moody underexposure'] },
    { max: 0.66, phrases: [] },
    { max: 1.0, phrases: ['high-key lighting', 'bright airy exposure', 'soft daylight'] },
  ],
  saturation: [
    { max: 0.33, phrases: ['desaturated muted palette', 'washed-out colors'] },
    { max: 0.66, phrases: [] },
    { max: 1.0, phrases: ['vivid saturated colors', 'punchy technicolor palette'] },
  ],
  contrast: [
    { max: 0.33, phrases: ['soft low-contrast', 'gentle flat lighting'] },
    { max: 0.66, phrases: [] },
    { max: 1.0, phrases: ['high contrast', 'chiaroscuro lighting', 'deep blacks and bright highlights'] },
  ],
  texture: [
    { max: 0.33, phrases: ['clean digital clarity', 'crisp sharp detail'] },
    { max: 0.66, phrases: [] },
    { max: 1.0, phrases: ['35mm film grain', 'analog texture', 'halation and light leaks'] },
  ],
  geometry: [
    { max: 0.33, phrases: ['organic flowing forms', 'natural irregular shapes'] },
    { max: 0.66, phrases: [] },
    { max: 1.0, phrases: ['clean geometric composition', 'strong architectural lines', 'symmetrical framing'] },
  ],
  density: [
    { max: 0.33, phrases: ['minimalist composition', 'lots of negative space'] },
    { max: 0.66, phrases: [] },
    { max: 1.0, phrases: ['dense layered detail', 'busy maximalist frame'] },
  ],
  era: [
    { max: 0.33, phrases: ['vintage analog aesthetic', 'retro nostalgic mood'] },
    { max: 0.66, phrases: [] },
    { max: 1.0, phrases: ['sleek futuristic aesthetic', 'iridescent hi-tech surfaces'] },
  ],
};

// A little extra flourish for very strong lens/lighting signals — the exact
// jargon the pitch calls out.
function lensGarnish(profile: TasteProfile): string[] {
  const byKey = Object.fromEntries(AXIS_KEYS.map((k, i) => [k, { t: profile.target[i], w: profile.weights[i] }]));
  const out: string[] = [];
  if (byKey.density.w > 0.5 && byKey.density.t < 0.35) out.push('shallow depth of field, 85mm lens');
  if (byKey.brightness.w > 0.5 && byKey.brightness.t < 0.35 && byKey.contrast.t > 0.6) out.push('volumetric lighting');
  return out;
}

export interface PromptStyle {
  // The style clause: comma-joined phrases derived from the locked taste.
  clause: string;
  // The individual phrases, for chip UIs.
  tags: string[];
}

// Build the style clause from a locked profile. Only axes above `threshold`
// weight contribute, so we never over-constrain what the user didn't care
// about.
export function synthesizeStyle(profile: TasteProfile, threshold = 0.35, maxTags = 6): PromptStyle {
  const tags: string[] = [];
  // Walk axes strongest-first so the most important style cues lead, and stop
  // once we have enough — a focused prompt beats a kitchen-sink one.
  for (const { key, weight } of dominantAxes(profile, AXIS_KEYS.length)) {
    if (tags.length >= maxTags) break;
    if (weight < threshold) continue;
    const val = profile.target[AXIS_KEYS.indexOf(key)];
    const band = VOCAB[key].find((b) => val <= b.max);
    if (!band || band.phrases.length === 0) continue;
    // Pick deterministically by value so the same taste yields the same words.
    tags.push(band.phrases[Math.floor(val * (band.phrases.length - 1) + 0.5) % band.phrases.length] ?? band.phrases[0]);
  }
  for (const g of lensGarnish(profile)) if (!tags.includes(g)) tags.push(g);
  return { clause: tags.join(', '), tags };
}

// Take a user's plain-language subject and dress it in their locked style. This
// is the payoff: they type "a dog walking down the street" and get a fully
// specified, on-brand prompt without knowing any of the vocabulary.
export function styledPrompt(profile: TasteProfile, subject: string): string {
  const s = subject.trim() || 'a quiet street at dawn';
  const { clause } = synthesizeStyle(profile);
  if (!clause) return s;
  return `${s}, ${clause}`;
}
