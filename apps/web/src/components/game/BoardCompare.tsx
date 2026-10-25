import { getPack } from '@pixwagon/packs';
import type { Board } from '@pixwagon/game-core';
import { isComplete } from '@pixwagon/game-core';
import { BoardCell } from './BoardCell.tsx';
import { BrokenLinkIcon } from '../ui/icons.tsx';
import { patternStyle } from '../../design/patterns.ts';
import { playerColor } from '../../design/tokens.ts';

/** One ranked player and every picture they played, oldest first. */
export interface BoardCompareEntry {
  playerId: string;
  name: string;
  seatIndex: number;
  rank: number;
  tied: boolean;
  leftMidGame: boolean;
  completedPictures: number;
  points: number;
  filled: number;
  /** Squares fewer than the player ranked above, when that decided the rank. */
  tieBreak?: number | null;
  /** `null` for a picture played before this player joined. */
  boards: readonly (Board | null)[];
}

export interface BoardCompareProps {
  entries: readonly BoardCompareEntry[];
  /** `same-board`: every row plays the same picture, so columns are named by
   *  picture. `own-board`: every cell is a different picture, so columns are
   *  just "Picture 1…" and each cell names its own. */
  mode?: 'same-board' | 'own-board';
  /** Marks this player's row ("You", and the accent border). */
  meId?: string;
  /** Pixel size of one cell in the miniature boards. Phone 5; the board rule's
   *  integer steps from there (pass 03 Annotation 28). */
  cellSize?: number;
}

/**
 * The session's boards side by side (pass 03 note 11, Annotation 28): a row
 * per player in rank order, a column per picture, so a same-board session
 * compares like with like. One component for both modes.
 *
 * Built from `BoardCell`, not `BoardCanvas`: a results screen shows a few
 * small boards that never change, so DOM cells cost nothing noticeable, and
 * they render in the static design-system card and the server-rendered
 * screen check, which a canvas cannot. Identity is hue **and** hatch (the
 * swatch and the filled cells); rank, "tied", "left", "done" and
 * "unfinished" are all text, never colour alone (CLAUDE.md §6).
 *
 * A pack with more pictures than fit scrolls the cells sideways while the
 * who column stays pinned, so the row you are reading never loses its name.
 */
export function BoardCompare({
  entries,
  mode = 'same-board',
  meId,
  cellSize = 5,
}: BoardCompareProps) {
  const columns = Math.max(0, ...entries.map((entry) => entry.boards.length));
  // A cell's column is as wide as the widest board in it, plus the caption.
  const columnWidth = Math.max(
    ...entries.flatMap((e) => e.boards.map((b) => b?.size.width ?? 0)),
    0,
  );
  // 6px of slack so a caption can breathe without widening the column; the
  // phone case (three 5px-cell pictures) has to fit 358px without scrolling.
  const cellWidth = `${columnWidth * cellSize + 6}px`;

  return (
    <div className="overflow-x-auto">
      <ol className="grid min-w-max gap-2">
        <li
          aria-hidden
          className="grid gap-1.5 px-2.5 font-mono text-xs tracking-wide text-ink-muted"
          style={{ gridTemplateColumns: `6.5rem repeat(${columns}, minmax(${cellWidth}, 1fr))` }}
        >
          <span />
          {Array.from({ length: columns }, (_, index) => (
            <span key={index} className="text-center">
              {mode === 'same-board' ? (columnName(entries, index) ?? '') : `Picture ${index + 1}`}
            </span>
          ))}
        </li>
        {entries.map((entry) => {
          const me = entry.playerId === meId;
          const color = playerColor(entry.seatIndex);
          return (
            <li
              key={entry.playerId}
              className={[
                'grid items-start gap-1.5 rounded-xl border bg-surface p-2.5',
                me ? 'border-accent' : 'border-border',
                entry.leftMidGame ? 'opacity-60' : '',
              ].join(' ')}
              style={{
                gridTemplateColumns: `6.5rem repeat(${columns}, minmax(${cellWidth}, 1fr))`,
              }}
            >
              <div className="sticky left-0 grid gap-0.5">
                <span className="font-mono text-xs text-ink-muted">
                  {ordinal(entry.rank)}
                  {entry.tied ? ' · tied' : ''}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <span
                    aria-hidden
                    className="size-3.5 shrink-0 rounded-full border border-black/10"
                    style={patternStyle(color.pattern, color.hex)}
                  />
                  {me ? 'You' : entry.name}
                </span>
                <span className="flex items-center gap-1 text-xs text-ink-muted">
                  {entry.leftMidGame ? (
                    <>
                      <BrokenLinkIcon size={12} />
                      left · {entry.points}
                    </>
                  ) : (
                    `${entry.completedPictures} ${entry.completedPictures === 1 ? 'picture' : 'pictures'} · ${entry.points}`
                  )}
                </span>
                {entry.tieBreak ? (
                  <span className="text-xs text-ink-muted">{entry.tieBreak} fewer squares</span>
                ) : null}
              </div>
              {entry.boards.map((board, index) => (
                <Cell
                  key={index}
                  board={board}
                  colorIndex={entry.seatIndex}
                  cellSize={cellSize}
                  showName={mode === 'own-board'}
                />
              ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "1st", "2nd", "3rd", "4th"… — rank as a word-ish, in the mono face. */
function ordinal(rank: number): string {
  const tail = rank % 100;
  if (tail >= 11 && tail <= 13) return `${rank}th`;
  return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
}

function pictureNameOf(board: Board): string {
  return (
    getPack(board.packId)?.pictures.find((p) => p.id === board.pictureId)?.name ?? board.pictureId
  );
}

/** The column's picture name in a same-board session: the first player's. */
function columnName(entries: BoardCompareProps['entries'], index: number): string | null {
  const board = entries.map((entry) => entry.boards[index]).find((b) => b);
  return board ? pictureNameOf(board) : null;
}

function Cell({
  board,
  colorIndex,
  cellSize,
  showName,
}: {
  board: Board | null;
  colorIndex: number;
  cellSize: number;
  showName: boolean;
}) {
  if (!board) {
    return <p className="self-center text-center text-xs text-ink-muted">joined later</p>;
  }
  const complete = isComplete(board);
  const name = pictureNameOf(board);
  return (
    <figure className="grid justify-items-center gap-1">
      <div
        role="img"
        aria-label={`${name}, ${complete ? 'done' : 'unfinished'}`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${board.size.width}, ${cellSize}px)`,
        }}
      >
        {board.cells.map((state, i) => (
          <BoardCell key={i} state={state} colorIndex={colorIndex} size={cellSize} />
        ))}
      </div>
      {/* In words, so done and unfinished never rest on tone: ✓ and bold for
          done. Own board adds the picture's name (every cell is a different
          one). */}
      <figcaption
        className={[
          'text-center text-xs',
          complete ? 'font-semibold text-ink' : 'text-ink-muted',
        ].join(' ')}
      >
        {showName
          ? complete
            ? `✓ ${name}`
            : `${name} · unfinished`
          : complete
            ? '✓ done'
            : 'unfinished'}
      </figcaption>
    </figure>
  );
}
