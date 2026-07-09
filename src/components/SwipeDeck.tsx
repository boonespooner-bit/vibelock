import { useCallback, useEffect, useRef, useState } from 'react';
import { Variation } from '../engine/variation';
import { TasteProfile } from '../engine/tasteEngine';
import { Swatch } from './Swatch';

interface Props {
  variations: Variation[];
  index: number;
  profile: TasteProfile;
  minSwipes: number;
  onSwipe: (v: Variation, liked: boolean) => void;
  onLock: () => void;
}

// Step 2: the swipe deck. Drag (or tap the buttons, or use ← / →) to sort. The
// live meter shows the Taste Engine converging in real time — the "quietly
// building behind the scenes" moment made visible.
export function SwipeDeck({ variations, index, profile, minSwipes, onSwipe, onLock }: Props) {
  const top = variations[index];
  const next = variations[index + 1];
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState<{ dir: 1 | -1 } | null>(null);

  const total = profile.likes + profile.dislikes;
  const canLock = total >= minSwipes && profile.confidence >= 0.55;

  const commit = useCallback(
    (liked: boolean) => {
      if (!top || leaving) return;
      setLeaving({ dir: liked ? 1 : -1 });
      // Let the fly-off animation play, then record.
      window.setTimeout(() => {
        onSwipe(top, liked);
        setLeaving(null);
        setDrag(null);
        startRef.current = null;
      }, 220);
    },
    [top, leaving, onSwipe],
  );

  // Keyboard: ← reject, → keep.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') commit(true);
      else if (e.key === 'ArrowLeft') commit(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [commit]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    setDrag({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const threshold = 110;
    if (drag.x > threshold) commit(true);
    else if (drag.x < -threshold) commit(false);
    else {
      setDrag(null);
      startRef.current = null;
    }
  };

  if (!top) {
    return (
      <div className="stage deck-stage">
        <div className="deck-empty">Spinning up more variations…</div>
      </div>
    );
  }

  const dx = leaving ? leaving.dir * 600 : drag?.x ?? 0;
  const dy = leaving ? -40 : drag?.y ?? 0;
  const rot = dx / 22;
  const intent = dx > 40 ? 'keep' : dx < -40 ? 'drop' : null;
  const pct = Math.round(profile.confidence * 100);

  return (
    <div className="stage deck-stage">
      <header className="stage-head compact">
        <p className="eyebrow">Step 2 — Swipe your taste</p>
        <h2>Keep what feels like you.</h2>
      </header>

      <div className="deck">
        {next && (
          <div className="card card--behind">
            <Swatch vec={next.vec} id={next.id} className="card-art" />
          </div>
        )}
        <div
          className={`card card--top ${leaving ? 'card--leaving' : ''} ${drag ? 'card--dragging' : ''}`}
          style={{ transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Swatch vec={top.vec} id={top.id} className="card-art" />
          <div className={`stamp stamp--keep ${intent === 'keep' ? 'on' : ''}`}>KEEP</div>
          <div className={`stamp stamp--drop ${intent === 'drop' ? 'on' : ''}`}>NOPE</div>
        </div>
      </div>

      <div className="deck-controls">
        <button className="circ circ--no" onClick={() => commit(false)} aria-label="Reject">
          ✕
        </button>
        <div className="meter" title="How well-defined your taste is so far">
          <div className="meter-track">
            <div className="meter-fill" style={{ width: `${pct}%` }} />
            <div className="meter-gate" style={{ left: '55%' }} title="Lock unlocks here" />
          </div>
          <span className="meter-label">
            {total} swipes · taste {pct}% defined
          </span>
        </div>
        <button className="circ circ--yes" onClick={() => commit(true)} aria-label="Keep">
          ♥
        </button>
      </div>

      <button className="lock-btn" disabled={!canLock} onClick={onLock}>
        {canLock ? '🔒 Lock this vibe' : `Swipe a little more to lock (${total}/${minSwipes})`}
      </button>
    </div>
  );
}
