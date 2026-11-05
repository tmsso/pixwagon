import { useRef } from 'react';
import { Link, useParams } from 'react-router';
import { scoreBoard } from '@pixwagon/game-core';
import { getPack } from '@pixwagon/packs';
import { BoardCanvas } from '../components/game/BoardCanvas.tsx';
import { OfferTray } from '../components/game/OfferTray.tsx';
import { PicturePreview } from '../components/game/PicturePreview.tsx';
import { PlayTable } from '../components/game/PlayTable.tsx';
import { ProgressMeter } from '../components/game/ProgressMeter.tsx';
import { usePlayControls } from '../components/game/usePlayControls.ts';
import { Button } from '../components/ui/Button.tsx';
import { useFitCellSize } from '../design/boardScale.ts';
import { FINE_POINTER, WIDE_LAYOUT, useMediaQuery } from '../design/useMediaQuery.ts';
import { fallbackHasLegalPlacement, pairHasLegalPlacement } from '../state/legality.ts';
import { pendingProblem, problemText, type PendingChoice } from '../state/placement.ts';
import { hasStaged } from '../state/playInput.ts';
import {
  SOLO_PLAYER_ID,
  activeCandidateCells,
  candidateCells,
  pendingCellCount,
  useSoloGameStore,
} from '../state/soloGame.ts';

/**
 * The solo game and the daily, at `/r/solo` and `/r/daily` (Phase 2, 7a).
 * Networked rooms at any other `/r/:code` render `RoomScreen` (`GameRoute`).
 * No connection pill: solo runs with no network at all (Annotation 08).
 *
 * Pass 04 (BRIEF-04): the play table. Both offers sit in a tray as pieces;
 * picking one up shows it on the board under the pointer; it is dropped with
 * a click or tap (or dragged straight from the tray), turned with right-click,
 * the wheel, R or a tap on it, and the move is sent with a compact ✓ Place.
 * Nothing covers the board any more.
 */
export function GameScreen() {
  const { code } = useParams();
  const store = useSoloGameStore;
  const board = store((state) => state.board);
  const roll = store((state) => state.roll);
  const round = store((state) => state.round);
  const status = store((state) => state.status);
  const pending = store((state) => state.pending);
  const lastRejection = store((state) => state.lastRejection);
  const packId = store((state) => state.packId);
  const pictureId = store((state) => state.pictureId);
  const daily = store((state) => state.daily);
  const actions = store.getState();

  const wide = useMediaQuery(WIDE_LAYOUT);
  const finePointer = useMediaQuery(FINE_POINTER);
  // A phone held sideways: keep the side panel compact enough for ✓ Place.
  const short = useMediaQuery('(max-height: 31.25rem)');
  const boardArea = useRef<HTMLDivElement>(null);
  const cellSize = useFitCellSize(boardArea, board.size.width, board.size.height);

  const score = scoreBoard(SOLO_PLAYER_ID, board);
  const picture = getPack(packId)?.pictures.find((p) => p.id === pictureId);
  const playing = status === 'playing';

  // Gated on the rules engine's own answer, not on a square count (pass 04).
  const problem = pending ? pendingProblem(board, roll, pending) : 'incomplete';
  const canCommit = problem === null;
  const canPass =
    !pending &&
    playing &&
    !pairHasLegalPlacement(board, roll.pair) &&
    !fallbackHasLegalPlacement(board, roll.fallback);

  const controls = usePlayControls({
    board,
    getPending: () => store.getState().pending,
    actions,
    canCommit,
    enabled: playing,
  });

  const count = pending ? pendingCellCount(pending) : 0;

  const pictureCard = (
    <div className="flex items-center gap-3">
      {picture ? (
        <div className="shrink-0 rounded-md border border-border bg-surface p-1">
          <PicturePreview
            rows={picture.rows}
            palette={picture.palette}
            cellSize={wide ? (short ? 4 : 10) : 3}
            label={`The picture to fill: ${picture.name}`}
          />
        </div>
      ) : null}
      <ProgressMeter
        filled={score.filled}
        total={score.total}
        label={picture ? picture.name : undefined}
      />
    </div>
  );

  const tray = !playing ? (
    <div className="grid gap-3 text-center">
      <p className="text-sm font-medium text-ink" role="status">
        Picture complete! +{score.points} points
      </p>
      <Link to="/results">
        <Button size="lg" className="w-full">
          See results
        </Button>
      </Link>
    </div>
  ) : (
    <OfferTray
      pair={roll.pair}
      fallback={roll.fallback}
      pending={pending}
      wide={wide}
      tileDrag={controls.tile}
      onSelect={actions.selectTile}
      onUndo={actions.undo}
      onTurn={controls.turnActive}
      onFlip={controls.flipActive}
      canUndo={hasStaged(pending)}
      commit={{
        label: count > 0 ? `✓ Place ${count}` : '✓ Place',
        disabled: !canCommit,
        onCommit: actions.commit,
      }}
      problem={problemText(problem === 'incomplete' ? null : problem)}
      pass={canPass ? { onPass: actions.passRound } : null}
    />
  );

  return (
    <PlayTable
      title={daily ? 'DAILY' : (code?.toUpperCase() ?? 'SOLO')}
      round={`Round ${round + 1}`}
      picture={pictureCard}
      boardAreaRef={boardArea}
      wide={wide}
      status={
        lastRejection ? (
          // Never scolding, never "invalid move" (pass 02, 03g).
          <span role="alert" className="text-ink">
            That didn&rsquo;t fit — those squares went back. Try another spot.
          </span>
        ) : (
          <span role="status">{boardHint(pending, finePointer)}</span>
        )
      }
      tray={tray}
      aside={finePointer ? <ShortcutLegend /> : null}
    >
      <BoardCanvas
        board={board}
        cellSize={cellSize}
        candidateCells={pending ? candidateCells(pending) : []}
        activeCandidateCells={pending ? activeCandidateCells(pending) : []}
        invalid={lastRejection !== null}
        {...controls.board}
      />
    </PlayTable>
  );
}

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

export function ShortcutLegend() {
  const rows: [string, string][] = [
    ['Click / drag', 'pick up and drop'],
    ['Right-click · R · wheel', 'turn'],
    ['Shift + right-click · F', 'flip'],
    ['Backspace', 'undo'],
    ['Enter · double-click', 'place'],
    ['Esc', 'put everything back'],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-ink-muted">
      {rows.map(([keys, what]) => (
        <div key={keys} className="contents">
          <dt className="font-mono text-ink">{keys}</dt>
          <dd>{what}</dd>
        </div>
      ))}
    </dl>
  );
}
