import { useEffect, useState } from 'react';
import { clearGallery, Generation, removeGeneration, useGallery } from '../lib/gallery';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

function download(gen: Generation) {
  const a = document.createElement('a');
  a.href = gen.image;
  a.download = `vibe-lock-${gen.subject.replace(/\s+/g, '-').slice(0, 40) || 'image'}.png`;
  a.click();
}

// A full-screen overlay of every past generation, reachable from the top bar in
// any phase. Click a tile to inspect it (full prompt, download, delete).
export function Gallery({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useGallery();
  const [selected, setSelected] = useState<Generation | null>(null);

  // Close on Escape (detail first, then the whole modal).
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selected) setSelected(null);
      else onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, selected, onClose]);

  if (!open) return null;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Your generations{items.length ? ` · ${items.length}` : ''}</h2>
          <div className="modal-head-actions">
            {items.length > 0 && (
              <button
                className="btn btn--ghost btn--small"
                onClick={() => {
                  if (confirm('Delete all saved generations? This can’t be undone.')) void clearGallery();
                }}
              >
                Clear all
              </button>
            )}
            <button className="modal-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="gallery-empty">
            <span className="gallery-empty-icon">🖼️</span>
            <p>No generations yet.</p>
            <p className="muted">Lock a vibe, hit “Generate with Gemini,” and your images collect here.</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {items.map((g) => (
              <button key={g.id} className="gallery-tile" onClick={() => setSelected(g)}>
                <img src={g.image} alt={g.subject} loading="lazy" />
                <div className="gallery-tile-meta">
                  <span className="gallery-tile-subject">{g.subject || 'Untitled'}</span>
                  <span className="gallery-tile-time">{timeAgo(g.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="detail-scrim" onClick={() => setSelected(null)}>
          <div className="detail" onClick={(e) => e.stopPropagation()}>
            <img className="detail-img" src={selected.image} alt={selected.subject} />
            <div className="detail-body">
              <div className="detail-row">
                <h3>{selected.subject || 'Untitled'}</h3>
                <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">
                  ✕
                </button>
              </div>
              <p className="detail-meta">
                {selected.model} · {new Date(selected.createdAt).toLocaleString()}
              </p>
              <code className="detail-prompt">{selected.prompt}</code>
              <div className="detail-actions">
                <button className="btn btn--primary btn--small" onClick={() => download(selected)}>
                  ⬇ Save
                </button>
                <button
                  className="btn btn--ghost btn--small"
                  onClick={() => {
                    void removeGeneration(selected.id);
                    setSelected(null);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
