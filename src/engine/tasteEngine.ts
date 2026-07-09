import { AXIS_KEYS, AxisKey, DIM, Vec, zeroVec } from './aesthetics';

// One recorded swipe.
export interface Swipe {
  vec: Vec;
  liked: boolean;
}

// The learned, portable Taste Engine. This is the artifact the user "Locks" and
// owns — a compact description of *what they like* and *how much each axis
// matters to them*, plus a synthesized target they gravitate toward.
export interface TasteProfile {
  // Where the user's taste lives on each axis (the "liked" centroid, pulled
  // slightly away from what they rejected).
  target: Vec;
  // How much the user actually *cares* about each axis, in [0,1]. High weight =
  // their likes and dislikes clearly diverge on this axis, so it's load-bearing
  // to their taste. Low weight = they were indifferent, so we leave it free.
  weights: Vec;
  // 0..1 — how much evidence backs this profile. Drives the "Lock" gate.
  confidence: number;
  likes: number;
  dislikes: number;
}

const EPS = 1e-6;

export function emptyProfile(): TasteProfile {
  return {
    target: zeroVec().map(() => 0.5),
    weights: zeroVec(),
    confidence: 0,
    likes: 0,
    dislikes: 0,
  };
}

function mean(vecs: Vec[]): Vec {
  const out = zeroVec();
  if (!vecs.length) return out.map(() => 0.5);
  for (const v of vecs) for (let i = 0; i < DIM; i++) out[i] += v[i];
  for (let i = 0; i < DIM; i++) out[i] /= vecs.length;
  return out;
}

function variance(vecs: Vec[], m: Vec): Vec {
  const out = zeroVec();
  if (vecs.length < 2) return out;
  for (const v of vecs) for (let i = 0; i < DIM; i++) out[i] += (v[i] - m[i]) ** 2;
  for (let i = 0; i < DIM; i++) out[i] /= vecs.length;
  return out;
}

// The learning step. Given every swipe so far, derive the taste profile.
//
// The core idea: an axis matters to the user when their likes and dislikes
// *separate* along it. If liked images are consistently warm and disliked ones
// consistently cool, warmth is load-bearing. If warmth is scattered on both
// sides, they don't care about it and we shouldn't constrain it. This is a
// tiny, transparent stand-in for what a fitted LoRA does implicitly.
export function learn(swipes: Swipe[]): TasteProfile {
  const liked = swipes.filter((s) => s.liked).map((s) => s.vec);
  const disliked = swipes.filter((s) => !s.liked).map((s) => s.vec);

  if (liked.length === 0) {
    return { ...emptyProfile(), likes: 0, dislikes: disliked.length };
  }

  const likeMean = mean(liked);
  const dislikeMean = disliked.length ? mean(disliked) : null;
  const likeVar = variance(liked, likeMean);

  const target = zeroVec();
  const weights = zeroVec();

  for (let i = 0; i < DIM; i++) {
    // Separation: how far apart the liked and disliked centroids sit on this
    // axis. Normalized so a full-range split (0 vs 1) reads as ~1.
    const separation = dislikeMean ? Math.min(1, Math.abs(likeMean[i] - dislikeMean[i]) / 0.5) : 0;
    // Consistency: low spread among likes means the user is decisive on this
    // axis. High spread means "anything goes" — down-weight it.
    const consistency = 1 - Math.min(1, likeVar[i] / 0.08);
    // An axis is load-bearing when likes are BOTH separated from dislikes AND
    // internally consistent. Either alone is weak evidence.
    weights[i] = Math.max(separation, 0.15) * (0.4 + 0.6 * consistency);

    // Nudge the target away from what was rejected, along this axis, scaled by
    // how much we trust the axis.
    if (dislikeMean) {
      const push = (likeMean[i] - dislikeMean[i]) * 0.25 * weights[i];
      target[i] = Math.max(0, Math.min(1, likeMean[i] + push));
    } else {
      target[i] = likeMean[i];
    }
  }

  // Normalize weights to a 0..1 relative scale so the strongest axis reads as 1.
  const maxW = Math.max(...weights, EPS);
  for (let i = 0; i < DIM; i++) weights[i] = weights[i] / maxW;

  const confidence = computeConfidence(liked.length, disliked.length, weights);

  return { target, weights, confidence, likes: liked.length, dislikes: disliked.length };
}

// Confidence grows with evidence and with how sharply the taste is defined.
// You need both likes and dislikes, and enough of them, to Lock.
export function computeConfidence(likes: number, dislikes: number, weights: Vec): number {
  const total = likes + dislikes;
  if (likes < 2 || dislikes < 2) {
    // Not enough contrast to separate signal from noise yet.
    return Math.min(0.35, total * 0.05);
  }
  const volume = 1 - Math.exp(-total / 8); // saturates as swipes accumulate
  // Definition: is taste actually pointed, or flat across all axes?
  const sorted = [...weights].sort((a, b) => b - a);
  const definition = sorted.slice(0, 3).reduce((s, w) => s + w, 0) / 3;
  return Math.max(0, Math.min(1, 0.35 + 0.4 * volume + 0.25 * definition));
}

// Weighted distance from a candidate to the locked target. Axes the user cares
// about count more; axes they left free barely count. Returns 0..1 where 0 is a
// perfect match.
export function distance(profile: TasteProfile, vec: Vec): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < DIM; i++) {
    const w = profile.weights[i];
    num += w * (vec[i] - profile.target[i]) ** 2;
    den += w;
  }
  if (den < EPS) return 0.5;
  return Math.sqrt(num / den);
}

// Higher is better — how "on-vibe" a candidate is, 0..1.
export function affinity(profile: TasteProfile, vec: Vec): number {
  return 1 - distance(profile, vec);
}

// Rank candidates by affinity (best first). This is what "run every generation
// through your Vibe-Lock" does under the hood.
export function rank<T extends { vec: Vec }>(profile: TasteProfile, candidates: T[]): T[] {
  return [...candidates].sort((a, b) => affinity(profile, b.vec) - affinity(profile, a.vec));
}

// Pull an arbitrary vector toward the locked target, per-axis, by each axis's
// weight. This is the "apply the filter" operation: a raw generation gets bent
// toward the user's taste most on the axes they care about, and left alone on
// the ones they don't. `strength` scales the whole effect.
export function applyLock(profile: TasteProfile, vec: Vec, strength = 1): Vec {
  const out = vec.slice();
  for (let i = 0; i < DIM; i++) {
    const pull = profile.weights[i] * strength;
    out[i] = vec[i] + (profile.target[i] - vec[i]) * Math.min(1, pull);
  }
  return out;
}

// The axes the user most cares about, strongest first — for UI + prompt.
export function dominantAxes(profile: TasteProfile, n = 4): { key: AxisKey; weight: number }[] {
  return AXIS_KEYS.map((key, i) => ({ key, weight: profile.weights[i] }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, n);
}
