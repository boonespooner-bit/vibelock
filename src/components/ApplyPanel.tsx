import { useMemo, useState } from 'react';
import { DIM, hashString, rng } from '../engine/aesthetics';
import { applyLock, TasteProfile } from '../engine/tasteEngine';
import { styledPrompt } from '../engine/prompt';
import { Swatch } from './Swatch';

const EXAMPLES = [
  'a dog walking down the street',
  'a sci-fi cityscape at night',
  'a bowl of ramen on a table',
  'a portrait of an old sailor',
];

// A stand-in for a "raw" model generation of the subject: deterministic, roughly
// neutral aesthetics seeded by the words. Applying the lock bends it toward the
// user's taste — the before/after makes the filter tangible.
function rawVecFor(subject: string): number[] {
  const rand = rng(hashString(subject || 'seed'));
  return Array.from({ length: DIM }, () => 0.35 + rand() * 0.3);
}

export function ApplyPanel({ profile }: { profile: TasteProfile }) {
  const [subject, setSubject] = useState(EXAMPLES[0]);
  const [copied, setCopied] = useState(false);

  const raw = useMemo(() => rawVecFor(subject), [subject]);
  const locked = useMemo(() => applyLock(profile, raw, 1), [profile, raw]);
  const prompt = useMemo(() => styledPrompt(profile, subject), [profile, subject]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — the text is visible to copy manually */
    }
  };

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
          <Swatch vec={locked} id={`locked-${hashString(subject)}`} className="ba-art ba-art--locked" />
          <figcaption>Through your Vibe-Lock</figcaption>
        </figure>
      </div>

      <div className="prompt-out">
        <code>{prompt}</code>
        <button className="btn btn--small" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy prompt'}
        </button>
      </div>
    </section>
  );
}
