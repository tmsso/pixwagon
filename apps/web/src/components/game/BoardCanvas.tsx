import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Board, CellRef } from '@pixwagon/game-core';
import { paintCellFill, paintPictureFill } from '../../design/canvasPatterns.ts';
import { playerColor } from '../../design/tokens.ts';
import { describeCell, initialCursor, moveCursor } from '../../state/boardCursor.ts';

export interface BoardCanvasProps {
  board: Board;
  /** Rendered pixel size of one grid cell at 1× device pixel ratio. */
  cellSize?: number;
  /** Whose hatch fills `filled` cells. Solo has one player, so this is a
   *  constant — per-cell player attribution is a same-board (Phase 5) concern,
   *  and `CellState` deliberately doesn't carry a player id (game-core/types.ts). */
  colorIndex?: number;
  /** Cells staged in the pending choice but not yet committed — the
   *  `candidate` state (`docs/design/surfaces/` Annotation 01). Drawn as the
   *  weak ghost: accent at 20%, dashed border. */
  candidateCells?: readonly CellRef[];
  /** The subset of `candidateCells` belonging to the active piece/blob — the
   *  strong ghost: accent at 35%, solid border (design pass 02, "Ghost vs.
   *  candidate"). Pass a subset of `candidateCells`, not disjoint cells. */
  activeCandidateCells?: readonly CellRef[];
  /** True while briefly showing `applyMove`'s rejection on the candidate
   *  cells before they clear — the `invalid` state. */
  invalid?: boolean;
  onCellPress?: (cell: CellRef) => void;
  /** Moves keyboard focus onto the board when this turns true — choosing an
   *  offer removes the button that had focus, and the next thing to do is
   *  place it on the board. */
  focusWhen?: boolean;
  /** Pass 04: the held piece drawn at the pointer, and whether it fits there.
   *  `anchor` is the square under the pointer (it gets the corner notch). */
  ghost?: { cells: readonly CellRef[]; fits: boolean; anchor?: CellRef | null } | null;
  /** Pass 04 (D19): the picture's own colour per square, row-major. When
   *  given, a filled square shows its colour with a light hatch for texture
   *  instead of the player's hatch colour. */
  fillColors?: readonly (string | null)[] | undefined;
  /** The picture is complete: the texture hatch drops out and the picture
   *  shows clean (handoff-04). */
  complete?: boolean;
  /** Staged pieces' handle squares (the corner notch). */
  stagedAnchors?: readonly CellRef[];
  /** The staged squares are the single being painted: a centre dot tells
   *  them from a staged piece. */
  painting?: boolean;
  /** A sent move the room's referee hasn't ruled on: vertical stripes. */
  checking?: boolean;
  /** Pass 04 (D20): squares the staged move would leave alone — a dotted ring. */
  loneCells?: readonly CellRef[];
  /** Pass 04: raw pointer events in board coordinates (`cell` is `null`
   *  outside the board). When given, the board is a direct-manipulation
   *  surface: `touch-action: none` so a drag never scrolls, and right-click
   *  never opens the browser menu. `onCellPress` still serves Enter/Space. */
  onBoardPointer?: (event: BoardPointer) => void;
  /** Mouse wheel over the board; return true when it was used (turned a
   *  piece), so the page doesn't also scroll. */
  onWheelTurn?: (direction: 1 | -1) => boolean;
  onDoubleClick?: () => void;
  /** The keyboard cursor moved (or left) — the play table aims the ghost there. */
  onCursorMove?: (cell: CellRef | null) => void;
  /** The canvas element, for code that maps screen points to squares (a piece
   *  dragged in from the tray). */
  canvasRef?: (canvas: HTMLCanvasElement | null) => void;
}

export interface BoardPointer {
  type: 'down' | 'move' | 'up' | 'leave' | 'cancel';
  cell: CellRef | null;
  pointerId: number;
  /** `mouse`, `touch` or `pen` — hover and the finger offset depend on it. */
  pointerType: string;
  button: number;
  shiftKey: boolean;
  /** Screen position, for telling a jittery tap from a drag in pixels. */
  clientX: number;
  clientY: number;
}

/**
 * Canvas rather than a grid of DOM nodes because a 40×30 board is 1,200 elements
 * and every optimistic fill would touch a slice of them; a canvas redraw is one
 * operation. It also gives crisp integer-scaled pixels on any display, which is
 * the entire visual premise of the game.
 *
 * `BoardCell.tsx` is the authority on what each cell state looks like in DOM
 * form; this mirrors it via `paintCellFill` for the two states (`blank`,
 * `fillable`, `locked` read straight off design tokens — only `filled` needs the
 * player hatch).
 */
export function BoardCanvas({
  board,
  cellSize = 20,
  colorIndex = 0,
  candidateCells = [],
  activeCandidateCells = [],
  invalid = false,
  onCellPress,
  focusWhen = false,
  ghost = null,
  loneCells = [],
  onBoardPointer,
  onWheelTurn,
  onDoubleClick,
  onCursorMove,
  canvasRef,
  fillColors,
  complete = false,
  stagedAnchors = [],
  painting = false,
  checking = false,
}: BoardCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  // The latest wheel handler, read by a listener attached once (below).
  const wheelRef = useRef(onWheelTurn);
  useEffect(() => {
    wheelRef.current = onWheelTurn;
  });
  const { width, height } = board.size;
  // Keyboard: the canvas is one tab stop with a roving cursor (Phase 9). The
  // cursor only shows while the board has focus, so a tap never draws it.
  const interactive = onCellPress !== undefined;
  const [cursor, setCursorState] = useState<CellRef | null>(null);
  const setCursor = (next: CellRef | null | ((c: CellRef | null) => CellRef | null)) => {
    setCursorState((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      if (value !== current) onCursorMove?.(value);
      return value;
    });
  };

  useEffect(() => {
    canvasRef?.(ref.current);
    return () => canvasRef?.(null);
  }, [canvasRef]);

  // React's own onWheel listener is passive, so it can't stop the page from
  // scrolling; turning a piece with the wheel needs a non-passive one.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const handler = wheelRef.current;
      if (handler && event.deltaY !== 0 && handler(event.deltaY > 0 ? 1 : -1)) {
        event.preventDefault();
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (focusWhen) ref.current?.focus();
  }, [focusWhen]);

  // "Just placed" (handoff-04): newly filled squares pop in over 160 ms
  // (`duration.normal`'s neighbourhood), unless the player asked the OS for
  // reduced motion. The first board seen never pops.
  const previousFilled = useRef<Set<number> | null>(null);
  const [pop, setPop] = useState<{ cells: ReadonlySet<number>; t: number } | null>(null);
  useEffect(() => {
    const now = new Set<number>();
    board.cells.forEach((cell, i) => {
      if (cell === 'filled') now.add(i);
    });
    const before = previousFilled.current;
    previousFilled.current = now;
    if (!before) return;
    const fresh = new Set([...now].filter((i) => !before.has(i)));
    if (fresh.size === 0) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const start = performance.now();
    const step = (time: number) => {
      const t = Math.min(1, (time - start) / 160);
      setPop(t < 1 ? { cells: fresh, t } : null);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [board]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Back the canvas with real device pixels, then scale the drawing context so
    // all subsequent coordinates stay in CSS pixels. Without this the board is
    // blurry on every phone.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * cellSize * dpr;
    canvas.height = height * cellSize * dpr;
    canvas.style.width = `${width * cellSize}px`;
    canvas.style.height = `${height * cellSize}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Pixel art must not be smoothed when scaled.
    ctx.imageSmoothingEnabled = false;

    const styles = getComputedStyle(canvas);
    const blank = styles.getPropertyValue('--color-cell-blank').trim() || '#f6f7f9';
    const fillable = styles.getPropertyValue('--color-cell-fillable').trim() || '#d3d9e0';
    const locked = styles.getPropertyValue('--color-cell-locked').trim() || '#adb7c2';
    const border = styles.getPropertyValue('--color-border').trim() || '#d3d9e0';
    const accent = styles.getPropertyValue('--color-accent').trim() || '#2a9d8a';
    const danger = styles.getPropertyValue('--color-danger').trim() || '#d64a3f';
    const color = playerColor(colorIndex);

    ctx.fillStyle = blank;
    ctx.fillRect(0, 0, width * cellSize, height * cellSize);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const state = board.cells[y * width + x];
        const px = x * cellSize;
        const py = y * cellSize;
        switch (state) {
          case 'fillable':
            ctx.fillStyle = fillable;
            ctx.fillRect(px, py, cellSize, cellSize);
            break;
          case 'locked':
            ctx.fillStyle = locked;
            ctx.fillRect(px, py, cellSize, cellSize);
            break;
          case 'filled': {
            const index = y * width + x;
            const scale = pop?.cells.has(index) ? 0.6 + 0.4 * (1 - (1 - pop.t) ** 3) : 1;
            const inset = (cellSize * (1 - scale)) / 2;
            const own = fillColors?.[index];
            if (own) {
              paintPictureFill(ctx, px + inset, py + inset, cellSize * scale, own, !complete);
            } else {
              paintCellFill(ctx, px, py, cellSize, color.pattern, color.hex);
            }
            break;
          }
          case 'blank':
          default:
            break;
        }
      }
    }

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, height * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(width * cellSize, y * cellSize + 0.5);
      ctx.stroke();
    }

    // Pass 04 looks (handoff-04, "Looks, as specified on the canvas"). Insets
    // are 2px strokes drawn inside the square; every state differs in shape
    // as well as colour (a notch, a dot, stripes, a diagonal), never colour
    // alone (CLAUDE.md §6).
    const accentHover = styles.getPropertyValue('--color-accent-hover').trim() || '#1f7a6c';
    const bgColor = styles.getPropertyValue('--color-bg').trim() || '#f6f7f9';
    const inset2 = (cell: CellRef, stroke: string) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(cell.x * cellSize + 1, cell.y * cellSize + 1, cellSize - 2, cellSize - 2);
      ctx.lineWidth = 1;
    };
    const notch = (cell: CellRef) => {
      const size = Math.max(4, Math.round(cellSize / 4));
      const px = cell.x * cellSize + 2;
      const py = cell.y * cellSize + 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + size, py);
      ctx.lineTo(px, py + size);
      ctx.closePath();
      ctx.fill();
    };
    const diagonalHatch = (cell: CellRef, stroke: string, alpha: number) => {
      const px = cell.x * cellSize;
      const py = cell.y * cellSize;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, cellSize, cellSize);
      ctx.clip();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1, cellSize / 12);
      const period = Math.max(4, cellSize / 4);
      for (let k = -cellSize; k < cellSize * 2; k += period) {
        ctx.beginPath();
        ctx.moveTo(px + k, py + cellSize);
        ctx.lineTo(px + k + cellSize, py);
        ctx.stroke();
      }
      ctx.restore();
    };
    const inBoard = (cell: CellRef) =>
      cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height;

    // Staged squares: accent at 65% with an accent-hover inset; the piece's
    // handle gets a corner notch; painted single squares get a centre dot.
    // Checking with the room: lighter, with vertical stripes. Rejected:
    // danger at 35% with a danger inset.
    const activeKeys = new Set(activeCandidateCells.map((cell) => `${cell.x},${cell.y}`));
    for (const cell of candidateCells) {
      const px = cell.x * cellSize;
      const py = cell.y * cellSize;
      if (invalid) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = danger;
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.globalAlpha = 1;
        inset2(cell, danger);
        continue;
      }
      if (checking) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = accent;
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = accentHover;
        const stripe = Math.max(2, Math.round(cellSize / 8));
        for (let sx = px + stripe; sx < px + cellSize; sx += stripe * 3) {
          ctx.fillRect(sx, py, stripe, cellSize);
        }
        ctx.globalAlpha = 1;
        continue;
      }
      const strong = activeKeys.has(`${cell.x},${cell.y}`);
      ctx.globalAlpha = strong ? 0.75 : 0.65;
      ctx.fillStyle = accent;
      ctx.fillRect(px, py, cellSize, cellSize);
      ctx.globalAlpha = 1;
      inset2(cell, accentHover);
      if (painting) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px + cellSize / 2, py + cellSize / 2, Math.max(2, cellSize / 9), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (!invalid && !checking) for (const cell of stagedAnchors) notch(cell);

    // The held piece at the pointer. Fits: accent at 45%, accent inset, notch
    // on the handle. Doesn't: a danger inset on every square, and a danger
    // diagonal hatch on the squares that are actually in the way.
    if (ghost) {
      const taken = new Set(candidateCells.map((cell) => `${cell.x},${cell.y}`));
      for (const cell of ghost.cells) {
        if (!inBoard(cell)) continue;
        if (ghost.fits) {
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = accent;
          ctx.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);
          ctx.globalAlpha = 1;
          inset2(cell, accent);
        } else {
          const state = board.cells[cell.y * width + cell.x];
          const blocked = state !== 'fillable' || taken.has(`${cell.x},${cell.y}`);
          if (blocked) diagonalHatch(cell, danger, 0.6);
          inset2(cell, danger);
          // A 1px white line inside the danger inset: on a red picture
          // (the Tram) the danger outline alone vanishes into the fill.
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.strokeRect(
            cell.x * cellSize + 3.5,
            cell.y * cellSize + 3.5,
            cellSize - 7,
            cellSize - 7,
          );
        }
      }
      if (ghost.fits && ghost.anchor && inBoard(ghost.anchor)) notch(ghost.anchor);
    }

    // A square this move would leave alone (D20): a 3px dotted ring on a
    // bg-coloured halo. The ring is signal-600, not the `warning` token: on
    // `cell-fillable` the current warning value measures 1.9:1 — handoff-04's
    // token proposal (warning → signal-600) is the owner's call; until then
    // only this ring uses the darker step.
    if (loneCells.length > 0) {
      const ring = styles.getPropertyValue('--color-signal-600').trim() || '#c96a25';
      for (const cell of loneCells) {
        const cx = cell.x * cellSize + cellSize / 2;
        const cy = cell.y * cellSize + cellSize / 2;
        const radius = cellSize / 2 - 4;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ring;
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.lineWidth = 1;
    }

    // The keyboard cursor, last so nothing hides it: a dark outline with a
    // light one inside it, so it reads on every square colour and in both
    // themes (never colour alone — it is also the only thick outline).
    if (cursor) {
      const ink = styles.getPropertyValue('--color-ink').trim() || '#171c21';
      const surface = styles.getPropertyValue('--color-surface').trim() || '#ffffff';
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ink;
      ctx.strokeRect(cursor.x * cellSize + 1, cursor.y * cellSize + 1, cellSize - 2, cellSize - 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = surface;
      ctx.strokeRect(
        cursor.x * cellSize + 2.5,
        cursor.y * cellSize + 2.5,
        cellSize - 5,
        cellSize - 5,
      );
    }
  }, [
    board,
    width,
    height,
    cellSize,
    colorIndex,
    candidateCells,
    activeCandidateCells,
    invalid,
    cursor,
    ghost,
    loneCells,
    fillColors,
    complete,
    stagedAnchors,
    painting,
    checking,
    pop,
  ]);

  function cellFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): CellRef | null {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellSize);
    const y = Math.floor((event.clientY - rect.top) / cellSize);
    return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
  }

  function toBoardPointer(
    type: BoardPointer['type'],
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): BoardPointer {
    return {
      type,
      cell: cellFromEvent(event),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      shiftKey: event.shiftKey,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  return (
    <>
      <canvas
        ref={ref}
        className={[
          onBoardPointer ? 'touch-none select-none' : 'touch-manipulation',
          'rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        ].join(' ')}
        // `application`, not `grid`: a canvas has no cells for a grid to
        // contain, and this one handles its own arrow keys.
        role="application"
        aria-roledescription="board"
        aria-label={`Board, ${width} by ${height}`}
        aria-describedby={interactive ? 'board-keys-hint' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onFocus={(event) => {
          // The cursor is for keyboard users. A tap focuses the canvas too (it
          // is a tab stop), and so does `focusWhen` after a tap on an offer;
          // neither matches `:focus-visible`, which is the browser's own
          // "this focus came from the keyboard" test, so touch never sees it.
          if (interactive && event.currentTarget.matches(':focus-visible')) {
            setCursor((current) => current ?? initialCursor(board));
          }
        }}
        onBlur={() => setCursor(null)}
        onKeyDown={(event) => {
          if (!onCellPress || !cursor) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onCellPress(cursor);
            return;
          }
          const next = moveCursor(cursor, event.key, board);
          if (next) {
            event.preventDefault();
            setCursor(next);
          }
        }}
        onContextMenu={onBoardPointer ? (event) => event.preventDefault() : undefined}
        onDoubleClick={onDoubleClick}
        onPointerDown={(event) => {
          if (onBoardPointer) {
            // Keep receiving this pointer's moves even off the board, so a
            // drag that leaves and comes back is still one drag.
            event.currentTarget.setPointerCapture?.(event.pointerId);
            onBoardPointer(toBoardPointer('down', event));
            return;
          }
          if (!onCellPress) return;
          const cell = cellFromEvent(event);
          if (cell) onCellPress(cell);
        }}
        onPointerMove={
          onBoardPointer ? (e) => onBoardPointer(toBoardPointer('move', e)) : undefined
        }
        onPointerUp={onBoardPointer ? (e) => onBoardPointer(toBoardPointer('up', e)) : undefined}
        onPointerLeave={
          onBoardPointer ? (e) => onBoardPointer(toBoardPointer('leave', e)) : undefined
        }
        onPointerCancel={
          onBoardPointer ? (e) => onBoardPointer(toBoardPointer('cancel', e)) : undefined
        }
      />
      {interactive ? (
        <>
          <span id="board-keys-hint" className="sr-only">
            Arrow keys move around the board. Enter or Space places on the highlighted square.
          </span>
          <span role="status" className="sr-only">
            {cursor ? describeCell(board, cursor) : ''}
          </span>
        </>
      ) : null}
    </>
  );
}
