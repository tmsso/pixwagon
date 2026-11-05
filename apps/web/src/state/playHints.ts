import type { PendingChoice } from './placement.ts';

/** The one line under the board: what the pointer does right now. */
export function boardHint(pending: PendingChoice | null, finePointer: boolean): string {
  if (!pending) return '';
  if (pending.kind === 'fallback') {
    return finePointer
      ? 'Click or drag across touching squares to paint them.'
      : 'Tap or drag across touching squares to paint them.';
  }
  const held = pending.pieces[pending.active].at === null;
  if (finePointer) {
    return held
      ? 'Click to drop it. Right-click or R turns it.'
      : 'Click a piece to pick it up again, or ✓ Place.';
  }
  return held
    ? 'Tap the picture to drop it.'
    : 'Tap a piece to turn it, drag it to move it, or ✓ Place.';
}
