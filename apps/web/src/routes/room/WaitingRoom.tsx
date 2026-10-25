import { useCallback, useState } from 'react';
import { MAX_PLAYERS } from '@pixwagon/protocol';
import type { RoomSnapshot } from '@pixwagon/protocol';
import { Button } from '../../components/ui/Button.tsx';
import { LinkIcon, RefreshIcon, TickIcon } from '../../components/ui/icons.tsx';
import { useRoomGameStore } from '../../state/roomGame.ts';
import { hostName, joinNames, startBlockedReason, waitingStatus } from '../../state/roomView.ts';
import { GameSheet, GameSummary } from './GameSettings.tsx';
import { RoomPlayers } from './RoomPlayers.tsx';

/**
 * The waiting room at `/r/CODE` (pass 03 `02c`–`02e`, `02h`, `02i`). The code
 * is the biggest thing on the page — it is the fallback when the clipboard
 * isn't available. The host starts the game (once, D2) and picks what is
 * played in a sheet; guests get no Start button, only a line saying who
 * decides, because a control that can never become theirs isn't shown
 * (Annotation 23).
 */
export function WaitingRoom({
  snapshot,
  arrivedByCode,
}: {
  snapshot: RoomSnapshot;
  /** The player typed this code in the Lobby, rather than following a link. */
  arrivedByCode: boolean;
}) {
  const me = useRoomGameStore((state) => state.me);
  const connection = useRoomGameStore((state) => state.connection);
  const configChange = useRoomGameStore((state) => state.configChange);
  const returned = useRoomGameStore((state) => state.returnedFromResults);
  const requestRoll = useRoomGameStore((state) => state.requestRoll);
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const isHost = me?.isHost ?? false;
  const blocked = startBlockedReason(snapshot, me);
  const status = waitingStatus(snapshot);
  const alone = snapshot.players.length <= 1;
  const awayNames = snapshot.players.filter((p) => !p.connected).map((p) => p.name);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${snapshot.code}`);
      setCopied(true);
    } catch {
      // Clipboard needs a secure context and permission; the code on screen
      // is the fallback, which is why it is the biggest thing on the page.
    }
  }

  return (
    <main className="mx-auto flex min-h-app max-w-md flex-col gap-4 bg-bg p-4">
      {returned ? (
        // A rematch is a return, not a restart (note 13, Annotation 32): said
        // once, at the top, to everyone who was watching it happen.
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-accent bg-accent/10 p-3 text-sm text-ink"
        >
          <span className="mt-0.5 shrink-0 text-accent-hover">
            <RefreshIcon />
          </span>
          {isHost
            ? 'Rematch — same room, new offers. Change the game if you like, then start.'
            : `Rematch — you’re back in room ${snapshot.code} with everyone.`}
        </p>
      ) : null}
      <header className="grid justify-items-center gap-2 pt-3">
        <p className="font-mono text-xs tracking-widest text-ink-muted uppercase">Room code</p>
        <p className="font-mono text-5xl font-bold tracking-widest text-ink">{snapshot.code}</p>
        <Button variant="secondary" size="sm" onClick={copyLink}>
          {copied ? <TickIcon size={16} /> : <LinkIcon size={16} />}
          {copied ? 'Link copied' : 'Copy link'}
        </Button>
      </header>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-muted uppercase">
          Players · {snapshot.players.length} of {MAX_PLAYERS}
        </h2>
        <div className="flex flex-wrap gap-2">
          <RoomPlayers snapshot={snapshot} me={me} inGame={false} />
        </div>
        {status ? <p className="mt-3 text-sm text-ink-muted">{status}</p> : null}
        {/* Annotation 27: a well-formed code nobody created opens a fresh,
            empty room (whose first player is its host), so someone who typed
            one and is alone in it may have mistyped. The note is only for
            them — never for a link, a room they just created, or company. */}
        {returned && isHost && awayNames.length > 0 ? (
          // They left the results before the rematch: their seat waits, and
          // opening the link again brings them back as themselves (D6).
          <p className="mt-2 text-sm text-ink-muted">
            {joinNames(awayNames)} left before the rematch. Their seat waits — they come back as
            themselves if they open the link again.
          </p>
        ) : null}
        {alone && arrivedByCode ? (
          <p className="mt-2 text-sm text-ink-muted">
            Expected friends here? Check the code with whoever sent it.
          </p>
        ) : null}
      </section>

      <GameSummary
        snapshot={snapshot}
        isHost={isHost}
        configChange={configChange}
        onChange={() => setSheetOpen(true)}
      />

      <div className="flex-1" />

      <div className="grid gap-2 text-center">
        {isHost ? (
          <>
            <Button size="lg" disabled={blocked !== null} onClick={requestRoll}>
              Start game
            </Button>
            {blocked ? <p className="text-sm text-ink-muted">{blocked}</p> : null}
          </>
        ) : (
          <p className="rounded-xl border border-border bg-surface p-3 text-ink">
            {hostName(snapshot)} starts the game when everyone&rsquo;s here.
          </p>
        )}
        {connection === 'reconnecting' ? (
          <p className="text-sm text-ink-muted" role="status">
            Reconnecting…
          </p>
        ) : null}
      </div>

      {sheetOpen && isHost ? <GameSheet snapshot={snapshot} onClose={closeSheet} /> : null}
    </main>
  );
}
