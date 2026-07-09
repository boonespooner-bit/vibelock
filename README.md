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

1. **Drop a mood board** — upload your own photos, or pick a starter board. Each
   uploaded image is analyzed on-device (`src/engine/analyze.ts`) into the same
   8-axis aesthetic space; a board is just a cluster of points in that space.
2. **Get your vibe** — "Reveal my vibe" reads the board's signature (the axes its
   images *agree* on) and gives you a prompt immediately, no swiping. Or "Refine
   by swiping": Vibe-Lock spins micro-variations and you swipe (drag, buttons, or
   ← / →) while a live meter shows the Taste Engine converging.
3. **Lock it** — you get your Taste Engine: a fingerprint of which axes you care
   about and where your taste sits, the prompt vocabulary it now speaks, an
   exportable `.tasteengine.json`, and a panel that styles *any* plain subject you
   type (and renders it, if a Gemini key is configured).

### What's real here (and what a full build would add)

The learning loop and articulation are genuinely implemented and unit-tested:

- **Real image analysis** (`src/engine/analyze.ts`). Uploaded photos are read on
  a canvas into the 8-axis vector: mean luminance → brightness, R-vs-B →
  warmth, HSV → saturation, luminance spread → contrast, high-frequency energy →
  texture/grain, and Sobel edges (on a de-grained blur) → density and
  geometric-vs-organic form. Free, private, and quota-free.
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

A production build would swap the per-axis preference model for a lightweight
per-user LoRA; the interaction design, the taste-weighting logic, and the
taste→language mapping carry over unchanged. **Real image generation is already
wired up** (see below) — the locked taste drives an actual Gemini render.

## Real image generation (Gemini)

Locking a vibe produces a styled prompt; **"✨ Generate with Gemini"** turns it
into a real image. The subject you type is run through your taste engine
(`styledPrompt`) and the finished prompt is sent to Google's
`gemini-2.5-flash-image` model, which returns the render.

The API key is **never** in the browser. A thin Node server (`server/index.mjs`)
holds `GEMINI_API_KEY`, proxies the call, and serves the frontend from the same
origin. Without a key the app still runs fully — you get the instant SVG
before/after preview and copyable prompts; only the "Generate" button is gated,
with an in-app hint.

Every render is saved to a **gallery** (top-bar button), backed by IndexedDB so
it persists across sessions. Click a tile to see its full prompt, download it, or
delete it (`src/lib/gallery.ts`, `src/components/Gallery.tsx`).

To enable it locally:

```bash
cp .env.example .env
# paste a key from https://aistudio.google.com/apikey into .env
npm run dev        # web (5173) + api (8787) together; Vite proxies /api
```

The `/api/generate` endpoint has a basic per-IP rate limit and prompt-length cap
— fine for a prototype, swap for a real limiter before scaling.

## Architecture

```
src/
  engine/                 # framework-free, fully unit-tested core
    aesthetics.ts         # the 8-axis feature space + seedable PRNG
    analyze.ts            # uploaded image -> aesthetic vector (canvas pixel math)
    variation.ts          # starter boards + micro-variation generator
    tasteEngine.ts        # learn()/profileFromVectors(); distance/rank/applyLock
    prompt.ts             # the Articulation-Gap bridge: profile -> prompt words
    render.ts             # deterministic SVG image from an aesthetic vector
    portable.ts           # the exportable, ownable "Taste Engine" artifact
    __tests__/            # vitest coverage of the learning + articulation logic
  lib/generate.ts         # client for the /api generation proxy
  lib/gallery.ts          # IndexedDB-backed store of past generations (+ hook)
  components/             # React UI (mood board, swipe deck, lock screen, apply, gallery)
  App.tsx                 # phase orchestration + adaptive card generation
server/
  index.mjs               # Express: serves dist/ + proxies Gemini (key stays here)
```

The `engine/` directory has no React dependency — the taste logic is portable to
a backend or another surface.

## Run it

```bash
npm install
npm run dev        # frontend (5173) + backend (8787); needs .env for generation
npm run dev:web    # frontend only (no server) — preview/swipe/lock still work
npm test           # engine unit tests (vitest)
npm run build      # typecheck + production build
npm start          # run the production server (serves dist/ + /api) on :8787
```

## Deploy (Render)

The included `render.yaml` deploys a single **Node web service** that serves the
frontend and the API together. After connecting the repo as a Blueprint, set
`GEMINI_API_KEY` in the Render dashboard (it's marked `sync: false` so it's never
committed). The service exposes `/api/health` for health checks.

## The moat

As production becomes a commodity, **taste becomes the asset**. Vibe-Lock is
infrastructure for digital identity: a way for creators to capture, own, carry,
and eventually monetize their unmistakable style — instead of everyone's output
regressing to the same mean.
