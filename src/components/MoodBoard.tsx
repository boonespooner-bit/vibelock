import { useRef, useState } from 'react';
import { analyzeImageFile } from '../engine/analyze';
import { Board, MoodItem, PRESET_BOARDS } from '../engine/variation';
import { Swatch } from './Swatch';

interface Props {
  onSwipeBoard: (board: Board) => void; // build a board, then refine by swiping
  onInstantBoard: (board: Board) => void; // build a board, jump straight to the vibe
}

let uid = 0;

// Step 1 of the pitch: "dump a messy mood board." Pick a starter board, or
// upload your own photos — each image is analyzed into its aesthetic vector
// right in the browser (see engine/analyze.ts), so your uploads flow through
// the same Taste Engine.
export function MoodBoard({ onSwipeBoard, onInstantBoard }: Props) {
  const [uploads, setUploads] = useState<MoodItem[]>([]);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      setError('Those files aren’t images — try JPG, PNG, or WebP.');
      return;
    }
    setBusy((n) => n + images.length);
    await Promise.all(
      images.map(async (file) => {
        try {
          const { vec, thumb } = await analyzeImageFile(file);
          const item: MoodItem = { id: `up-${uid++}`, label: file.name.replace(/\.[^.]+$/, ''), emoji: '🖼️', vec, thumb };
          setUploads((prev) => [...prev, item]);
        } catch {
          setError('Couldn’t read one of those images — it may be an unsupported format.');
        } finally {
          setBusy((n) => n - 1);
        }
      }),
    );
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (id: string) => setUploads((prev) => prev.filter((i) => i.id !== id));

  const board: Board = { id: 'custom', name: 'My mood board', items: uploads };
  const ready = uploads.length >= 1 && busy === 0;

  return (
    <div className="stage board-stage">
      <header className="stage-head">
        <p className="eyebrow">Step 1 — Drop a mood board</p>
        <h2>Start from a vibe, not a text box.</h2>
        <p className="sub">
          Upload your own photos and Vibe-Lock reads their aesthetic — or pick a starter board.
          Everything is analyzed on-device; nothing is uploaded to a server.
        </p>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />

      {uploads.length > 0 && (
        <section className="tray">
          <div className="tray-head">
            <h3>Your mood board · {uploads.length} image{uploads.length === 1 ? '' : 's'}</h3>
            {uploads.length < 3 && <span className="tray-hint">Add a few more for a sharper read</span>}
          </div>
          <div className="tray-grid">
            {uploads.map((it) => (
              <figure key={it.id} className="tray-item">
                <img src={it.thumb} alt={it.label} />
                <button className="tray-remove" onClick={() => remove(it.id)} aria-label="Remove">
                  ✕
                </button>
              </figure>
            ))}
            <button className="tray-add" onClick={() => inputRef.current?.click()} disabled={busy > 0}>
              {busy > 0 ? '…' : '＋'}
            </button>
          </div>
          <div className="tray-actions">
            <button className="btn btn--primary" disabled={!ready} onClick={() => onInstantBoard(board)}>
              ✨ Reveal my vibe
            </button>
            <button className="btn" disabled={!ready} onClick={() => onSwipeBoard(board)}>
              Refine by swiping →
            </button>
          </div>
        </section>
      )}

      {error && <p className="gen-error">{error}</p>}

      <div className="board-grid">
        {uploads.length === 0 && (
          <button className="board-card board-card--upload board-card--active" onClick={() => inputRef.current?.click()}>
            <div className="upload-inner">
              <span className="upload-plus">{busy > 0 ? '…' : '＋'}</span>
              <h3>Upload your own</h3>
              <p>Photos · screenshots · film stills</p>
              <span className="board-cta">Choose images →</span>
            </div>
          </button>
        )}

        {PRESET_BOARDS.map((b) => (
          <button key={b.id} className="board-card" onClick={() => onSwipeBoard(b)}>
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
      </div>
    </div>
  );
}
