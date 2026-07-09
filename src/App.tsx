import { useMemo, useState } from 'react';
import { Board, generateVariations, Variation } from './engine/variation';
import { learn, profileFromVectors, rank, Swipe } from './engine/tasteEngine';
import { MoodBoard } from './components/MoodBoard';
import { SwipeDeck } from './components/SwipeDeck';
import { LockScreen } from './components/LockScreen';

type Phase = 'board' | 'swipe' | 'lock';

const BATCH = 12;
const MIN_SWIPES = 8;

export default function App() {
  const [phase, setPhase] = useState<Phase>('board');
  const [board, setBoard] = useState<Board | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [index, setIndex] = useState(0);
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [batchSeed, setBatchSeed] = useState(1);

  // Two sources of truth for taste, blended by evidence:
  //  - boardProfile: read straight from the mood board (what its images agree on)
  //  - learned: read from swipes (what you kept vs. rejected)
  // Until there's real swipe signal, the board's own read stands in — so an
  // upload gives you a prompt immediately, and swiping only sharpens it.
  const boardProfile = useMemo(
    () => (board ? profileFromVectors(board.items.map((i) => i.vec)) : null),
    [board],
  );
  const learned = useMemo(() => learn(swipes), [swipes]);
  const swipeSignal = learned.likes >= 2 && learned.dislikes >= 2;
  const profile = swipeSignal ? learned : boardProfile ?? learned;

  const start = (b: Board, next: Phase) => {
    setBoard(b);
    setVariations(generateVariations(b.items, BATCH, 1));
    setIndex(0);
    setSwipes([]);
    setBatchSeed(1);
    setPhase(next);
  };

  const onSwipe = (v: Variation, liked: boolean) => {
    const nextSwipes = [...swipes, { vec: v.vec, liked }];
    setSwipes(nextSwipes);
    const nextIndex = index + 1;
    setIndex(nextIndex);

    // Running low? Generate the next batch. Once the engine has a read on the
    // user, gently bias new cards toward the emerging taste (best-first) so the
    // deck converges instead of staying random — "the app quietly building."
    if (board && nextIndex >= variations.length - 3) {
      const seed = batchSeed + 1;
      let fresh = generateVariations(board.items, BATCH, seed * 97 + 13);
      const nextLearned = learn(nextSwipes);
      if (nextLearned.confidence > 0.4) {
        // Keep the most on-vibe two-thirds, in a light-to-strong order.
        fresh = rank(nextLearned, fresh).slice(0, Math.ceil(BATCH * 0.75));
      }
      setVariations((prev) => [...prev, ...fresh]);
      setBatchSeed(seed);
    }
  };

  const reset = () => {
    setPhase('board');
    setBoard(null);
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
        {phase === 'board' && (
          <MoodBoard onSwipeBoard={(b) => start(b, 'swipe')} onInstantBoard={(b) => start(b, 'lock')} />
        )}
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
