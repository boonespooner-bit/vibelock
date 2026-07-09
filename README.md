# 🔒 Vibe-Lock

**Turn curation into a generative act.** Vibe-Lock replaces the empty text prompt
with an intuitive swipe. You dump in a vibe, swipe on micro-variations, and lock
your unique aesthetic into a portable **Taste Engine** — so any generation comes
out speaking your visual language, without you ever writing `85mm lens` or
`volumetric lighting`.

This repo is a working prototype of the core idea: the swipe-to-taste learning
loop and the **Articulation-Gap bridge** (taste → prompt vocabulary), running
entirely in the browser with no model calls and no external assets.

## The problem it solves

There's a gap between human capability and AI interfaces — the **Articulation
Gap**. People have refined taste but freeze when asked to translate it into a
50-word prompt full of photography jargon. Generative tools force users to be
*engineers of language* when they'd rather be *curators of vibes*. Vibe-Lock lets
you curate; it does the articulating.

## How the prototype works

Three steps, matching the pitch:

1. **Drop a mood board** — pick a starter board (uploads are stubbed). Each board
   is a small cluster of points in an 8-axis aesthetic space.
2. **Swipe your taste** — Vibe-Lock spins the board into micro-variations. You
   swipe (drag, tap the buttons, or use ← / →). A live meter shows the Taste
   Engine converging. Later cards are quietly biased toward your emerging taste.
3. **Lock it** — you get your Taste Engine: a fingerprint of which axes you care
   about and where your taste sits, the prompt vocabulary it now speaks, an
   exportable `.tasteengine.json`, and a panel that styles *any* plain subject
   you type.

### What's real here (and what a full build would add)

The learning loop and articulation are genuinely implemented and unit-tested:

- **Real signal from swipes.** Cards aren't stock images — each is an SVG
  rendered deterministically from its aesthetic vector (`src/engine/render.ts`),
  so a "warm grainy" card really is warmer and grainier. Swiping produces true
  preference data.
- **Real taste learning** (`src/engine/tasteEngine.ts`). The engine finds the
  axes where your *likes and dislikes separate* and how *consistent* your likes
  are, and weights those axes up. Axes you're indifferent to are left free. This
  is a small, transparent stand-in for what a fitted LoRA learns implicitly.
- **Real articulation** (`src/engine/prompt.ts`). The locked profile is
  translated back into concrete generative vocabulary — but only for the axes
  you cared about, and only the end you landed on.

A production build would swap the SVG renderer + preference model for actual
image/video generation and a lightweight per-user LoRA; the interaction design,
the taste-weighting logic, and the taste→language mapping carry over unchanged.

## Architecture

```
src/
  engine/                 # framework-free, fully unit-tested core
    aesthetics.ts         # the 8-axis feature space + seedable PRNG
    variation.ts          # starter boards + micro-variation generator
    tasteEngine.ts        # learn() weights axes; distance/affinity/rank/applyLock
    prompt.ts             # the Articulation-Gap bridge: profile -> prompt words
    render.ts             # deterministic SVG image from an aesthetic vector
    portable.ts           # the exportable, ownable "Taste Engine" artifact
    __tests__/            # vitest coverage of the learning + articulation logic
  components/             # React UI (mood board, swipe deck, lock screen, apply)
  App.tsx                 # phase orchestration + adaptive card generation
```

The `engine/` directory has no React dependency — the taste logic is portable to
a backend or another surface.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (vitest)
npm run build      # typecheck + production build
```

## The moat

As production becomes a commodity, **taste becomes the asset**. Vibe-Lock is
infrastructure for digital identity: a way for creators to capture, own, carry,
and eventually monetize their unmistakable style — instead of everyone's output
regressing to the same mean.
