// Vibe-Lock backend.
//
// Two jobs:
//   1. Serve the built frontend (dist/) in production.
//   2. Proxy image generation to the Gemini API so the API key stays server-side
//      and never ships to the browser.
//
// The taste engine lives in the client: the browser turns a locked profile +
// plain subject into a styled prompt (src/engine/prompt.ts), and sends that
// finished prompt here. This server stays thin — it relays to Gemini and
// returns the image.

import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

const PORT = Number(process.env.PORT) || 8787;
const HOST = '0.0.0.0'; // bind all interfaces so platform health checks can reach us

// Surface any startup/async crash in the logs instead of dying silently.
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));
process.on('uncaughtException', (e) => console.error('uncaughtException:', e));
const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const MAX_PROMPT = 1200;
const REQUEST_TIMEOUT_MS = 60_000;

const app = express();
app.use(express.json({ limit: '256kb' }));

// --- tiny in-memory rate limiter (per IP) -------------------------------------
// Not production-grade, but enough to keep a public prototype endpoint from
// being trivially drained. Swap for a real limiter (Redis, etc.) before scaling.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map(); // ip -> number[] (timestamps)

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}
// Occasionally evict stale IPs so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) {
    const live = arr.filter((t) => now - t < WINDOW_MS);
    if (live.length) hits.set(ip, live);
    else hits.delete(ip);
  }
}, WINDOW_MS).unref();

// --- health -------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(API_KEY), model: MODEL });
});

// --- generate -----------------------------------------------------------------
app.post('/api/generate', async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({
      error: 'no_api_key',
      message: 'Server is missing GEMINI_API_KEY. Set it in the environment to enable generation.',
    });
  }

  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip;
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited', message: 'Too many requests — try again in a minute.' });
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) {
    return res.status(400).json({ error: 'bad_request', message: 'A non-empty "prompt" is required.' });
  }
  if (prompt.length > MAX_PROMPT) {
    return res.status(400).json({ error: 'prompt_too_long', message: `Prompt exceeds ${MAX_PROMPT} characters.` });
  }

  // Optional aspect ratio, constrained to values the image models accept.
  const ASPECTS = new Set(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3']);
  const aspectRatio = typeof req.body?.aspectRatio === 'string' && ASPECTS.has(req.body.aspectRatio)
    ? req.body.aspectRatio
    : null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
  // imageConfig.aspectRatio is the supported control for Gemini image models.
  if (aspectRatio && aspectRatio !== '1:1') generationConfig.imageConfig = { aspectRatio };
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const message = data?.error?.message || `Gemini API error (${upstream.status}).`;
      // Distinguish quota/billing (429) from other upstream failures so the UI
      // can give actionable guidance. Don't leak the key.
      if (upstream.status === 429) {
        return res.status(429).json({ error: 'quota', message });
      }
      return res.status(502).json({ error: 'upstream', message });
    }

    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const inline = imagePart?.inlineData || imagePart?.inline_data;
    if (!inline?.data) {
      // Model may have refused or returned only text (e.g. safety block).
      const text = parts.find((p) => p.text)?.text;
      return res.status(422).json({
        error: 'no_image',
        message: text ? `Model returned no image: ${text}` : 'Model returned no image for this prompt.',
      });
    }

    const mime = inline.mimeType || inline.mime_type || 'image/png';
    return res.json({ image: `data:${mime};base64,${inline.data}`, model: MODEL, prompt });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return res.status(aborted ? 504 : 500).json({
      error: aborted ? 'timeout' : 'server_error',
      message: aborted ? 'Generation timed out. Try again.' : 'Unexpected server error during generation.',
    });
  } finally {
    clearTimeout(timer);
  }
});

// --- static frontend + SPA fallback (prod) ------------------------------------
app.use(express.static(DIST));
app.get('*', (_req, res) => res.sendFile(join(DIST, 'index.html')));

app.listen(PORT, HOST, () => {
  console.log(`Vibe-Lock server on ${HOST}:${PORT} · model=${MODEL} · key=${API_KEY ? 'set' : 'MISSING'}`);
});
