import { useMemo, useState } from 'react';
import { AXES, AXIS_KEYS, AxisKey } from '../engine/aesthetics';
import { TasteProfile } from '../engine/tasteEngine';
import { synthesizeStyle } from '../engine/prompt';
import { toPortable } from '../engine/portable';
import { ApplyPanel } from './ApplyPanel';

const axisByKey = Object.fromEntries(AXES.map((a) => [a.key, a])) as Record<AxisKey, (typeof AXES)[number]>;

// Step 3: the locked, ownable Taste Engine — the fingerprint, the vocabulary it
// speaks, and the export. Below it, the payoff panel where any plain subject
// comes out styled.
export function LockScreen({
  profile,
  onRemix,
  onReset,
}: {
  profile: TasteProfile;
  onRemix: () => void;
  onReset: () => void;
}) {
  const [name, setName] = useState('');
  const style = useMemo(() => synthesizeStyle(profile), [profile]);

  const download = () => {
    const engine = toPortable(profile, name);
    const blob = new Blob([JSON.stringify(engine, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${engine.name.replace(/\s+/g, '-').toLowerCase()}.tasteengine.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stage lock-stage">
      <header className="stage-head">
        <p className="eyebrow lock-eyebrow">🔒 Vibe locked</p>
        <h2>This is your Taste Engine.</h2>
        <p className="sub">
          It's portable and yours. From now on, run any generation through it and the output speaks
          your visual language — no prompt engineering required.
        </p>
      </header>

      <div className="lock-grid">
        <section className="panel fingerprint">
          <h3 className="panel-title">Taste fingerprint</h3>
          <p className="panel-hint">
            Taller bars are the axes you clearly care about. The dot marks where your taste sits.
          </p>
          <ul className="axis-list">
            {AXIS_KEYS.map((k, i) => {
              const def = axisByKey[k];
              const w = profile.weights[i];
              const t = profile.target[i];
              return (
                <li key={k} className={w >= 0.5 ? 'axis axis--strong' : 'axis'}>
                  <div className="axis-labels">
                    <span>{def.low}</span>
                    <span className="axis-name">{def.label}</span>
                    <span>{def.high}</span>
                  </div>
                  <div className="axis-bar" style={{ opacity: 0.35 + 0.65 * w }}>
                    <div className="axis-track" />
                    <div className="axis-dot" style={{ left: `${t * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel speak">
          <h3 className="panel-title">What it tells the model</h3>
          <p className="panel-hint">Your swipes, translated into the words a generator understands:</p>
          {style.tags.length ? (
            <div className="chips">
              {style.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">Keep swiping to sharpen the signal — no axis is decisive yet.</p>
          )}

          <div className="name-row">
            <input
              className="name-input"
              placeholder="Name your vibe (e.g. Sunday Super-8)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>
          <div className="lock-actions">
            <button className="btn btn--primary" onClick={download}>
              ⬇ Export Taste Engine
            </button>
            <button className="btn" onClick={onRemix}>
              Keep refining
            </button>
            <button className="btn btn--ghost" onClick={onReset}>
              Start over
            </button>
          </div>
        </section>
      </div>

      <ApplyPanel profile={profile} />
    </div>
  );
}
