import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Roll } from '@pixwagon/game-core';
import {
  placeActiveOrigin,
  setActive,
  startFallback,
  startPair,
  toggleBlobCell,
} from '../../state/placement.ts';
import { PlacementEditor } from './PlacementEditor.tsx';

const roll: Roll = { round: 1, seed: 's', pair: ['domino', 'monomino'], fallback: '1+2' };
const noop = () => {};
const handlers = {
  onSetActive: noop,
  onRotate: noop,
  onMirror: noop,
  onTakeBack: noop,
  onCancel: noop,
  onCommit: noop,
};

function html(pending: Parameters<typeof PlacementEditor>[0]['pending'], complete = false) {
  return renderToStaticMarkup(
    <PlacementEditor
      pending={pending}
      commitLabel="Place 3 squares"
      commitDisabled={!complete}
      {...handlers}
    />,
  );
}

describe('PlacementEditor — pair', () => {
  it('opens with the active piece prompting a tap and the other "Not placed"', () => {
    const markup = html(startPair(roll));
    expect(markup).toContain('The pair');
    expect(markup).toContain('Tap the board');
    expect(markup).toContain('Not placed');
    expect(markup).not.toContain('placed at ('); // the retired debug copy
  });

  it('shows "On the board" for a placed piece', () => {
    const markup = html(placeActiveOrigin(startPair(roll), { x: 3, y: 3 }));
    expect(markup).toContain('On the board');
  });

  it('offers Turn, Flip and Take back as labelled tools', () => {
    const markup = html(startPair(roll));
    for (const label of ['Turn', 'Flip', 'Take back']) {
      expect(markup).toContain(`aria-label="${label}"`);
    }
    expect(markup).toContain('<svg'); // outline icons, not raw glyphs
  });

  it('disables Take back until something is placed, enables it after', () => {
    // `disabled=""` is the real attribute; the class list also contains the
    // literal "disabled:" Tailwind prefixes, so match the attribute exactly.
    expect(html(startPair(roll))).toMatch(/aria-label="Take back"[^>]*disabled=""/);
    const placed = html(placeActiveOrigin(startPair(roll), { x: 1, y: 1 }));
    expect(placed).not.toMatch(/aria-label="Take back"[^>]*disabled=""/);
  });

  it('disables the commit button until the choice is complete', () => {
    expect(html(startPair(roll))).toMatch(/disabled=""[^>]*>Place 3 squares</);

    let choice = placeActiveOrigin(startPair(roll), { x: 0, y: 0 });
    choice = placeActiveOrigin(choice, { x: 5, y: 5 });
    expect(html(choice, true)).not.toMatch(/disabled=""[^>]*>Place 3 squares</);
  });
});

describe('PlacementEditor — single', () => {
  it('labels the offer "The single" and shows only Take back (a blob has no orientation)', () => {
    const markup = html(startFallback(roll));
    expect(markup).toContain('The single');
    expect(markup).toContain('aria-label="Take back"');
    expect(markup).not.toContain('aria-label="Turn"');
    expect(markup).not.toContain('aria-label="Flip"');
  });

  it('reads blob progress as "N more square(s)" then "N of N · done"', () => {
    let choice = startFallback(roll); // blobs [1, 2]
    expect(html(choice)).toContain('1 more square'); // active is the size-1 blob
    choice = toggleBlobCell(choice, { x: 2, y: 2 });
    choice = setActive(choice, 1);
    const markup = html(choice);
    expect(markup).toContain('1 of 1 · done'); // blob 0 now full
    expect(markup).toContain('2 more squares'); // blob 1, size 2, empty
  });
});
