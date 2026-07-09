import { PRESET_BOARDS } from '../engine/variation';
import { Swatch } from './Swatch';

// Step 1 of the pitch: "dump a messy mood board." Uploads aren't wired in this
// prototype, so we offer three ready-made boards to spin a deck from — plus the
// affordance where real uploads would live.
export function MoodBoard({ onPick }: { onPick: (boardId: string) => void }) {
  return (
    <div className="stage board-stage">
      <header className="stage-head">
        <p className="eyebrow">Step 1 — Drop a mood board</p>
        <h2>Start from a vibe, not a text box.</h2>
        <p className="sub">
          Pick a starter board to spin a deck from. In the full product you'd drop in your own
          photos, film stills, and clips — Vibe-Lock reads their aesthetic and takes it from here.
        </p>
      </header>

      <div className="board-grid">
        {PRESET_BOARDS.map((b) => (
          <button key={b.id} className="board-card" onClick={() => onPick(b.id)}>
            <div className="board-thumbs">
              {b.items.map((it) => (
                <Swatch key={it.id} vec={it.vec} id={`thumb-${it.id}`} className="thumb" />
              ))}
            </div>
            <div className="board-meta">
              <h3>{b.name}</h3>
              <p>{b.blurb}</p>
            </div>
            <span className="board-cta">Use this board →</span>
          </button>
        ))}

        <div className="board-card board-card--upload" aria-disabled>
          <div className="upload-inner">
            <span className="upload-plus">＋</span>
            <h3>Your own board</h3>
            <p>Photos · film stills · a drum loop</p>
            <span className="soon">Uploads coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
