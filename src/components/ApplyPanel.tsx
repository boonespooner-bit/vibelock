import { useEffect, useMemo, useRef, useState } from 'react';
import { DIM, hashString, rng } from '../engine/aesthetics';
import { applyLock, TasteProfile } from '../engine/tasteEngine';
import { styledPrompt } from '../engine/prompt';
import { checkHealth, generateImage, GenerateError, Health } from '../lib/generate';
import { Swatch } from './Swatch';

const EXAMPLES = [
  'a dog walking down the street',
  'a sci-fi cityscape at night',
  'a bowl of ramen on a table',
  'a portrait of an old sailor',
];

// A stand-in for a "raw" model generation of the subject: deterministic, roughly
// neutral aesthetics seeded by the words. Applying the lock bends it toward the
// user's taste — the before/after makes the filter tangible even before a real
// render comes back.
function rawVecFor(subject: string): number[] {
  const rand = rng(hashString(subject || 'seed'));
  return Array.from({ length: DIM }, () => 0.35 + rand() * 0.3);
}

type GenState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; image: string; prompt: string }
  | { status: 'error'; code: string; message: string };

export function ApplyPanel({ profile }: { profile: TasteProfile }) {
  const [subject, setSubject] = useState(EXAMPLES[0]);
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [gen, setGen] = useState<GenState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const raw = useMemo(() => rawVecFor(subject), [subject]);
  const locked = useMemo(() => applyLock(profile, raw, 1), [profile, raw]);
  const prompt = useMemo(() => styledPrompt(profile, subject), [profile, subject]);

  useEffect(() => {
    checkHealth().then(setHealth);
    return () => abortRef.current?.abort();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — the text is visible to copy manually */
    }
  };

  const generate = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGen({ status: 'loading' });
    try {
      const result = await generateImage(prompt, ctrl.signal);
      setGen({ status: 'done', image: result.image, prompt: result.prompt });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      const err = e as GenerateError;
      setGen({ status: 'error', code: err.code ?? 'error', message: err.message });
    }
  };

  const genUnavailable = health !== null && !health.hasKey;

  return (
    <section className="panel apply">
      <h3 className="panel-title">Try it on anything</h3>
      <p className="panel-hint">
        Type a plain idea. Vibe-Lock runs it through your locked taste — same subject, your look.
      </p>

      <input
        className="subject-input"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="a dog walking down the street"
      />
      <div className="example-chips">
        {EXAMPLES.map((e) => (
          <button key={e} className={`chip chip--btn ${e === subject ? 'chip--active' : ''}`} onClick={() => setSubject(e)}>
            {e}
          </button>
        ))}
      </div>

      <div className="ba">
        <figure className="ba-item">
          <Swatch vec={raw} id={`raw-${hashString(subject)}`} className="ba-art" />
          <figcaption>Raw model</figcaption>
        </figure>
        <div className="ba-arrow" aria-hidden>
          →
        </div>
        <figure className="ba-item">
          {gen.status === 'done' ? (
            <img className="ba-art ba-art--locked ba-art--real" src={gen.image} alt="Gemini render in your locked style" />
          ) : (
            <div className={`ba-art ba-art--locked ${gen.status === 'loading' ? 'ba-art--loading' : ''}`}>
              <Swatch vec={locked} id={`locked-${hashString(subject)}`} className="ba-art" />
              {gen.status === 'loading' && <div className="gen-overlay">Generating…</div>}
            </div>
          )}
          <figcaption>{gen.status === 'done' ? 'Gemini · your Vibe-Lock' : 'Through your Vibe-Lock'}</figcaption>
        </figure>
      </div>

      <div className="prompt-out">
        <code>{prompt}</code>
        <button className="btn btn--small" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy prompt'}
        </button>
      </div>

      <div className="gen-row">
        <button className="btn btn--primary" onClick={generate} disabled={gen.status === 'loading'}>
          {gen.status === 'loading' ? '✨ Generating…' : '✨ Generate with Gemini'}
        </button>
        {gen.status === 'done' && (
          <a className="btn btn--small" href={gen.image} download={`vibe-lock-${hashString(subject)}.png`}>
            ⬇ Save image
          </a>
        )}
        {health?.hasKey && <span className="gen-note">model: {health.model}</span>}
      </div>

      {genUnavailable && (
        <p className="gen-hint">
          Real generation is off — the server has no <code>GEMINI_API_KEY</code>. Add one (see README) to
          turn these prompts into real images. The before/after preview above still works without it.
        </p>
      )}
      {gen.status === 'error' && (
        <p className={`gen-error ${gen.code === 'no_api_key' ? 'gen-hint' : ''}`}>
          {gen.message}
        </p>
      )}
    </section>
  );
}
