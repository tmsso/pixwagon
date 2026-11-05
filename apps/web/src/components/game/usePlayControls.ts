import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Board, CellRef } from '@pixwagon/game-core';
import { candidateCells, isPendingComplete, type PendingChoice } from '../../state/placement.ts';
import {
  ghostAt,
  heldPiece,
  keyAction,
  loneSquaresAfter,
  stagedFits,
  stagedPieceAt,
  type Ghost,
} from '../../state/playInput.ts';
import type { BoardPointer } from './BoardCanvas.tsx';

/** What the play table needs from a store — solo and room stores both have it. */
export interface PlayActions {
  selectTile: (kind: 'pair' | 'fallback', index: number) => void;
  placeActive: (cell: CellRef) => void;
  toggleBlobCell: (cell: CellRef) => void;
  pickUp: (index: number, grab?: CellRef) => void;
  rotatePiece: (index: number) => void;
  mirrorPiece: (index: number) => void;
  undo: () => void;
  cancelChoice: () => void;
  commit: () => void;
}

interface Drag {
  pointerId: number;
  pointerType: string;
  /** stage: aiming the held piece · move: carrying a picked-up piece ·
   *  tap-staged: a touch on a staged piece, a turn unless it becomes a drag ·
   *  paint: painting the single · tray: a piece dragged in from its tile. */
  mode: 'stage' | 'move' | 'tap-staged' | 'paint' | 'tray';
  start: CellRef | null;
  startX: number;
  startY: number;
  moved: boolean;
  pieceIndex: number;
}

/**
 * On touch the finger hides the square it is on, so while a piece is being
 * dragged its handle floats this many rows above the finger (BRIEF-04,
 * Gestures). A plain tap still lands exactly where it touched.
 */
const LIFT_ROWS = 2;
/** Movement (CSS px) before a press counts as a drag rather than a tap —
 *  a finger always jitters a little, and without this a tap near a square's
 *  edge would count as a drag and land the piece two rows up. */
const DRAG_SLOP = 8;
/** A press on a piece within this long of dropping it there is the second
 *  half of a double-click (place), not a pick-up. */
const DOUBLE_CLICK_MS = 400;

function same(a: CellRef | null, b: CellRef | null): boolean {
  return a !== null && b !== null && a.x === b.x && a.y === b.y;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The pass 04 pointer, keyboard and wheel layer (BRIEF-04, "Gestures"): turns
 * raw events from the board and the tray into the pure `playInput.ts` model's
 * actions. It owns only what is transient — where the pointer is and what a
 * press in progress means — and reads the composed move fresh from the store
 * through `getPending` on every event, because one gesture often spans several
 * store updates before React re-renders.
 */
export function usePlayControls({
  board,
  getPending,
  actions,
  canCommit,
  enabled,
}: {
  board: Board;
  getPending: () => PendingChoice | null;
  actions: PlayActions;
  /** The composed move is complete and legal (✓ Place would be live). */
  canCommit: boolean;
  /** False while the player can't act (waiting, referee ruling, done). */
  enabled: boolean;
}) {
  const [hover, setHover] = useState<CellRef | null>(null);
  const drag = useRef<Drag | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const lastDrop = useRef<{ cell: CellRef; at: number } | null>(null);
  const setCanvas = useCallback((element: HTMLCanvasElement | null) => {
    canvas.current = element;
  }, []);

  const pending = getPending();
  const shownHover = enabled ? hover : null;
  const ghost: Ghost | null = ghostAt(board, pending, shownHover);
  const staged = pending ? candidateCells(pending) : [];
  // Warn about lone squares for what is staged plus a ghost that fits, so the
  // warning shows while aiming, before the piece is dropped.
  const loneCells = loneSquaresAfter(board, ghost?.fits ? [...staged, ...ghost.cells] : staged);

  const heldIndex = (): number | null => {
    const choice = getPending();
    return choice?.kind === 'pair' && heldPiece(choice) ? choice.active : null;
  };

  /** Which piece a turn or flip acts on: the one in hand, else the staged one
   *  under the pointer, else the active one. */
  const turnTarget = (cell: CellRef | null): number | null => {
    const choice = getPending();
    if (choice?.kind !== 'pair') return null;
    return heldIndex() ?? (cell ? stagedPieceAt(choice, cell) : null) ?? choice.active;
  };

  const lifted = (cell: CellRef | null, d: Drag): CellRef | null =>
    cell && d.pointerType !== 'mouse' && d.moved ? { x: cell.x, y: cell.y - LIFT_ROWS } : cell;

  const cellAtPoint = (clientX: number, clientY: number): CellRef | null => {
    const element = canvas.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const size = rect.width / board.size.width;
    const x = Math.floor((clientX - rect.left) / size);
    const y = Math.floor((clientY - rect.top) / size);
    return x >= 0 && y >= 0 && x < board.size.width && y < board.size.height ? { x, y } : null;
  };

  /** A staged piece that no longer fits after a turn or flip goes back to
   *  the hand, still turned, rather than sitting on the board looking placed
   *  (handoff-04, `Main`). */
  const settle = (index: number) => {
    const choice = getPending();
    if (choice && !stagedFits(board, choice, index)) actions.pickUp(index);
  };

  const turn = (index: number | null, direction: 1 | -1 = 1) => {
    if (index === null) return;
    // A quarter turn back is three forward; the model only turns clockwise.
    for (let i = 0; i < (direction === 1 ? 1 : 3); i += 1) actions.rotatePiece(index);
    settle(index);
  };

  const flip = (index: number | null) => {
    if (index === null) return;
    actions.mirrorPiece(index);
    settle(index);
  };

  /** Drops the held piece with its handle on `cell` — only where it fits. A
   *  drop that doesn't fit stays in hand, and the red ghost stays where it
   *  was aimed so the player can see why. */
  const drop = (cell: CellRef | null): boolean => {
    if (!cell) return false;
    const ghostHere = ghostAt(board, getPending(), cell);
    if (!ghostHere?.fits) {
      setHover(cell);
      return false;
    }
    actions.placeActive(cell);
    lastDrop.current = { cell, at: Date.now() };
    return true;
  };

  function onBoardPointer(event: BoardPointer) {
    if (!enabled) return;
    const choice = getPending();
    const d = drag.current;

    if (event.type === 'down') {
      if (event.button === 2) {
        // Right-click turns; with Shift it flips (BRIEF-04 gesture table).
        const index = turnTarget(event.cell);
        if (index !== null) {
          if (event.shiftKey) flip(index);
          else turn(index);
        }
        return;
      }
      if (event.button !== 0 || !event.cell || !choice) return;
      const base = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        start: event.cell,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        pieceIndex: 0,
      };
      if (choice.kind === 'fallback') {
        actions.toggleBlobCell(event.cell);
        drag.current = { ...base, mode: 'paint' };
        return;
      }
      const index = stagedPieceAt(choice, event.cell);
      const recent = lastDrop.current;
      if (
        index !== null &&
        recent &&
        same(recent.cell, event.cell) &&
        Date.now() - recent.at < DOUBLE_CLICK_MS
      ) {
        // The second press of a double-click on the piece just dropped:
        // leave it be, so the double-click can place the move.
        return;
      }
      // A press on a staged piece always takes that piece — even with the
      // other one in hand (which then waits in the tray).
      if (index !== null) {
        if (event.pointerType === 'mouse') {
          // A click on a staged piece picks it up by that square.
          actions.pickUp(index, event.cell);
          setHover(event.cell);
          drag.current = { ...base, mode: 'move', pieceIndex: index };
        } else {
          drag.current = { ...base, mode: 'tap-staged', pieceIndex: index };
        }
        return;
      }
      if (heldIndex() !== null) {
        drag.current = { ...base, mode: 'stage' };
        setHover(event.cell);
      }
      return;
    }

    if (event.type === 'move') {
      if (!d) {
        if (event.pointerType === 'mouse') setHover(event.cell);
        return;
      }
      if (event.pointerId !== d.pointerId) return;
      if (!d.moved && Math.hypot(event.clientX - d.startX, event.clientY - d.startY) > DRAG_SLOP) {
        d.moved = true;
      }
      if (d.mode === 'paint') {
        const choiceNow = getPending();
        // Painting past the last square stops there, rather than restarting
        // the group under the pointer.
        if (!choiceNow || isPendingComplete(choiceNow)) return;
        const painted = candidateCells(choiceNow);
        if (event.cell && !painted.some((c) => same(c, event.cell))) {
          actions.toggleBlobCell(event.cell);
        }
        return;
      }
      if (d.mode === 'tap-staged' && d.moved && d.start) {
        // The touch became a drag: lift the piece by the square it started on.
        actions.pickUp(d.pieceIndex, d.start);
        d.mode = 'move';
      }
      if (d.mode === 'stage' || d.mode === 'move') setHover(lifted(event.cell, d));
      return;
    }

    if (event.type === 'up') {
      if (!d || event.pointerId !== d.pointerId) return;
      drag.current = null;
      if (d.mode === 'tap-staged') {
        // A tap on a staged piece turns it in place (touch has no right-click).
        turn(d.pieceIndex);
      } else if (d.mode === 'stage' || (d.mode === 'move' && d.moved)) {
        if (drop(lifted(event.cell, d)) && event.pointerType !== 'mouse') setHover(null);
      }
      return;
    }

    if (event.type === 'leave') {
      if (!d && event.pointerType === 'mouse') setHover(null);
      return;
    }

    // cancel
    drag.current = null;
    if (event.pointerType !== 'mouse') setHover(null);
  }

  function onWheelTurn(direction: 1 | -1): boolean {
    if (!enabled) return false;
    const choice = getPending();
    if (choice?.kind !== 'pair') return false;
    const index = heldIndex() ?? (hover ? stagedPieceAt(choice, hover) : null);
    if (index === null) return false;
    turn(index, direction);
    return true;
  }

  /** Enter or Space on the board's keyboard cursor: the same as a click there,
   *  or ✓ Place when nothing is in hand. */
  function onCellPress(cell: CellRef) {
    if (!enabled) return;
    const choice = getPending();
    if (!choice) return;
    if (choice.kind === 'fallback') {
      actions.toggleBlobCell(cell);
      return;
    }
    if (heldIndex() !== null) {
      drop(cell);
      return;
    }
    const index = stagedPieceAt(choice, cell);
    if (index !== null) actions.pickUp(index, cell);
    else if (canCommit) actions.commit();
  }

  // Keys anywhere on the page (BRIEF-04: R, F, Backspace, Esc, 1–4, Enter).
  const keyState = useRef({ enabled, canCommit, actions, getPending, turn, flip });
  useEffect(() => {
    keyState.current = { enabled, canCommit, actions, getPending, turn, flip };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = keyState.current;
      if (!state.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target)) return;
      if (event.key === 'Enter') {
        // Buttons handle their own Enter, and so does the board while its
        // keyboard cursor is showing (it prevents the default). A board that
        // merely has focus from a click passes Enter on to here.
        const target = event.target as HTMLElement | null;
        const onBoard = target?.getAttribute('aria-roledescription') === 'board';
        if (event.defaultPrevented || (target && target !== document.body && !onBoard)) return;
        if (state.canCommit) {
          event.preventDefault();
          state.actions.commit();
        }
        return;
      }
      const action = keyAction(event.key);
      if (!action) return;
      const choice = state.getPending();
      const index = choice?.kind === 'pair' ? choice.active : null;
      switch (action.kind) {
        case 'rotate':
          if (index !== null) state.turn(index);
          break;
        case 'mirror':
          if (index !== null) state.flip(index);
          break;
        case 'undo':
          state.actions.undo();
          break;
        case 'cancel':
          state.actions.cancelChoice();
          break;
        case 'select':
          if (action.tile < 2) state.actions.selectTile('pair', action.tile);
          else state.actions.selectTile('fallback', action.tile - 2);
          break;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // A piece dragged in from its tray tile. The tile captures the pointer, so
  // its moves and release arrive here wherever the finger or mouse goes.
  const tile = {
    onPointerDown(kind: 'pair' | 'fallback', index: number, event: ReactPointerEvent) {
      if (!enabled || event.button !== 0) return;
      // Keep focus where it was: a focused tile would turn the next Enter
      // into "select this tile again" — picking a just-dropped piece back up
      // — instead of ✓ Place.
      event.preventDefault();
      actions.selectTile(kind, index);
      if (kind !== 'pair') return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        mode: 'tray',
        start: null,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        pieceIndex: index,
      };
    },
    onPointerMove(event: ReactPointerEvent) {
      const d = drag.current;
      if (!d || d.mode !== 'tray' || event.pointerId !== d.pointerId) return;
      if (!d.moved && Math.hypot(event.clientX - d.startX, event.clientY - d.startY) < DRAG_SLOP) {
        return;
      }
      d.moved = true;
      setHover(lifted(cellAtPoint(event.clientX, event.clientY), d));
    },
    onPointerUp(event: ReactPointerEvent) {
      const d = drag.current;
      if (!d || d.mode !== 'tray' || event.pointerId !== d.pointerId) return;
      drag.current = null;
      if (d.moved) {
        if (drop(lifted(cellAtPoint(event.clientX, event.clientY), d))) {
          if (event.pointerType !== 'mouse') setHover(null);
        }
      }
    },
    onPointerCancel() {
      drag.current = null;
    },
  };

  return {
    ghost,
    loneCells,
    /** Spread onto `BoardCanvas`. */
    board: {
      onBoardPointer,
      onWheelTurn,
      onCellPress,
      onCursorMove: (cell: CellRef | null) => setHover(cell),
      onDoubleClick: () => {
        // Read fresh: the first click of the pair may have just completed the move.
        if (keyState.current.enabled && keyState.current.canCommit) actions.commit();
      },
      canvasRef: setCanvas,
      ghost,
      loneCells,
    },
    tile,
    /** The action bar's Turn / Flip: the piece in hand, else the active one. */
    turnActive: () => turn(turnTarget(null)),
    flipActive: () => flip(turnTarget(null)),
  };
}
