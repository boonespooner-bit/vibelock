import { useMemo, useState } from 'react';
import { PRESET_BOARDS, generateVariations, Variation } from './engine/variation';
import { learn, rank, Swipe } from './engine/tasteEngine';
import { MoodBoard } from './components/MoodBoard';
import { SwipeDeck } from './components/SwipeDeck';
import { LockScreen } from './components/LockScreen';

type Phase = 'board' | 'swipe' | 'lock';

const BATCH = 12;
const MIN_SWIPES = 8;

export default function App() {
  const [phase, setPhase] = useState<Phase>('board');
  const [boardId, setBoardId] = useState<string | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [index, setIndex] = useState(0);
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [batchSeed, setBatchSeed] = useState(1);

  const profile = useMemo(() => learn(swipes), [swipes]);

  const startBoard = (id: string) => {
    const board = PRESET_BOARDS.find((b) => b.id === id)!;
    setBoardId(id);
    setVariations(generateVariations(board.items, BATCH, 1));
    setIndex(0);
    setSwipes([]);
    setBatchSeed(1);
    setPhase('swipe');
  };

  const onSwipe = (v: Variation, liked: boolean) => {
    setSwipes((prev) => [...prev, { vec: v.vec, liked }]);
    const nextIndex = index + 1;
    setIndex(nextIndex);

    // Running low? Generate the next batch. Once the engine has a read on the
    // user, gently bias new cards toward the emerging taste (best-first) so the
    // deck converges instead of staying random — "the app quietly building."
    if (nextIndex >= variations.length - 3) {
      const board = PRESET_BOARDS.find((b) => b.id === boardId)!;
      const seed = batchSeed + 1;
      let fresh = generateVariations(board.items, BATCH, seed * 97 + 13);
      const learned = learn([...swipes, { vec: v.vec, liked }]);
      if (learned.confidence > 0.4) {
        // Keep the most on-vibe two-thirds, in a light-to-strong order.
        fresh = rank(learned, fresh).slice(0, Math.ceil(BATCH * 0.75));
      }
      setVariations((prev) => [...prev, ...fresh]);
      setBatchSeed(seed);
    }
  };

  const reset = () => {
    setPhase('board');
    setBoardId(null);
    setVariations([]);
    setIndex(0);
    setSwipes([]);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-lock">🔒</span>
          <span className="brand-name">Vibe-Lock</span>
        </div>
        <p className="tagline">Curate your taste. Lock it. Generate as you.</p>
      </header>

      <main>
        {phase === 'board' && <MoodBoard onPick={startBoard} />}
        {phase === 'swipe' && (
          <SwipeDeck
            variations={variations}
            index={index}
            profile={profile}
            minSwipes={MIN_SWIPES}
            onSwipe={onSwipe}
            onLock={() => setPhase('lock')}
          />
        )}
        {phase === 'lock' && (
          <LockScreen profile={profile} onRemix={() => setPhase('swipe')} onReset={reset} />
        )}
      </main>

      <footer className="footer">
        <span>
          Prototype · the "Taste Engine" learning loop &amp; Articulation-Gap bridge, running fully
          in your browser.
        </span>
      </footer>
    </div>
  );
}
