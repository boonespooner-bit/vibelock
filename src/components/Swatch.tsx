import { useMemo } from 'react';
import { Vec } from '../engine/aesthetics';
import { renderSvg } from '../engine/render';

// Renders an aesthetic vector as an image. Memoized on the vector so we don't
// re-run the SVG builder on every parent render.
export function Swatch({ vec, id, className }: { vec: Vec; id: string; className?: string }) {
  const svg = useMemo(() => renderSvg(vec, id), [vec, id]);
  return <div className={className} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
}
