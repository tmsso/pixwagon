import type { Board } from '@pixwagon/game-core';
import { isComplete } from '@pixwagon/game-core';
import { BoardCell } from './BoardCell.tsx';
import { PlayerChip } from './PlayerChip.tsx';

/** One ranked player and every picture they played, oldest first. */
export interface BoardCompareEntry {
  playerId: string;
  name: string;
  seatIndex: number;
  rank: number;
  tied: boolean;
  leftMidGame: boolean;
  completedPictures: number;
  filled: number;
  /** `null` for a picture played before this player joined. */
  boards: readonly (Board | null)[];
}

export interface BoardCompareProps {
  entries: readonly BoardCompareEntry[];
  /** Marks this player's row ("you"). */
  meId?: string;
  /** Pixel size of one cell in the miniature boards. */
  cellSize?: number;
}

/**
 * Finished boards side by side, one ranked row per player (pass 02 note 6,
 * Phase 6). Works for both modes: in same-board every row shows the same
 * pictures, in own-board each row shows that player's own.
 *
 * Built from `BoardCell`, not `BoardCanvas`: a results screen shows a few
 * small boards that never change, so DOM cells cost nothing noticeable, and
 * they render in the static design-system card and the server-rendered
 * screen check, which a canvas cannot. Identity is hue **and** hatch (the
 * chip and the filled cells); rank, "tied", "left" and "complete" are all
 * text, never colour alone (CLAUDE.md §6).
 */
export function BoardCompare({ entries, meId, cellSize = 5 }: BoardCompareProps) {
  return (
    <ol className="grid gap-4">
      {entries.map((entry) => (
        <li key={entry.playerId} className="grid gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="w-6 text-right font-mono text-ink-muted">{entry.rank}.</span>
            <PlayerChip
              name={entry.playerId === meId ? `${entry.name} (you)` : entry.name}
              colorIndex={entry.seatIndex}
              active={entry.playerId === meId}
              connected={!entry.leftMidGame}
            />
            <span className="text-sm text-ink-muted">
              {entry.completedPictures} complete · {entry.filled} squares
              {entry.tied ? ' · tied' : ''}
              {entry.leftMidGame ? ' · left' : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-3 pl-9">
            {entry.boards.map((board, index) =>
              board ? (
                <figure key={index} className="grid justify-items-center gap-1">
                  <MiniBoard board={board} colorIndex={entry.seatIndex} cellSize={cellSize} />
                  <figcaption className="text-xs text-ink-muted">
                    {isComplete(board) ? '✓ complete' : `picture ${index + 1}`}
                  </figcaption>
                </figure>
              ) : (
                <p key={index} className="text-xs text-ink-muted">
                  joined after picture {index + 1}
                </p>
              ),
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function MiniBoard({
  board,
  colorIndex,
  cellSize,
}: {
  board: Board;
  colorIndex: number;
  cellSize: number;
}) {
  return (
    <div
      role="img"
      aria-label={`${board.pictureId}, ${isComplete(board) ? 'complete' : 'unfinished'}`}
      className="rounded-md border border-border bg-surface p-1"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${board.size.width}, ${cellSize}px)`,
      }}
    >
      {board.cells.map((state, i) => (
        <BoardCell key={i} state={state} colorIndex={colorIndex} size={cellSize} />
      ))}
    </div>
  );
}
