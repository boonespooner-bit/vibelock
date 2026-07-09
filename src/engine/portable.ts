import { AXIS_KEYS } from './aesthetics';
import { synthesizeStyle } from './prompt';
import { TasteProfile } from './tasteEngine';

// The portable, ownable artifact — the thing the pitch calls a "Taste Engine"
// you can save, carry between tools, and monetize. It's small, human-readable,
// and self-describing: the axis keys travel with it so it survives schema
// changes.
export interface PortableEngine {
  format: 'vibe-lock/taste-engine';
  version: 1;
  name: string;
  createdAt: string;
  axes: readonly string[];
  target: number[];
  weights: number[];
  confidence: number;
  // Denormalized for consumers that just want the words, not the math.
  styleTags: string[];
  styleClause: string;
}

export function toPortable(profile: TasteProfile, name: string): PortableEngine {
  const style = synthesizeStyle(profile);
  return {
    format: 'vibe-lock/taste-engine',
    version: 1,
    name: name.trim() || 'Untitled Vibe',
    createdAt: new Date().toISOString(),
    axes: AXIS_KEYS,
    target: profile.target.map((n) => round(n)),
    weights: profile.weights.map((n) => round(n)),
    confidence: round(profile.confidence),
    styleTags: style.tags,
    styleClause: style.clause,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
