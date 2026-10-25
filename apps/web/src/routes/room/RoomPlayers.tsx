import type { RoomSnapshot } from '@pixwagon/protocol';
import { PlayerChip } from '../../components/game/PlayerChip.tsx';
import type { RoomPlayerIdentity } from '../../state/roomGame.ts';
import { boardCompletion, playerStatus } from '../../state/roomView.ts';

export function RoomPlayers({
  snapshot,
  me,
  inGame,
}: {
  snapshot: RoomSnapshot;
  me: RoomPlayerIdentity | null;
  inGame: boolean;
}) {
  return (
    <>
      {/* Seat order, not arrival order: the server lists live sockets in
          whatever order the runtime returns them, and chips reshuffling on
          every reconnect would make "who is who" harder, not easier. */}
      {[...snapshot.players]
        .sort((x, y) => x.seatIndex - y.seatIndex)
        .map((player) => (
          <PlayerChip
            key={player.id}
            // In-game the design names yourself "You" (`12a`); in the waiting
            // room everyone sees the same names (`02c`–`02e`).
            name={inGame && player.id === me?.playerId ? 'You' : player.name}
            colorIndex={player.seatIndex}
            host={!inGame && player.isHost}
            // The waiting room tags your own chip "you" (`02c`–`02e`).
            you={!inGame && player.id === me?.playerId}
            active={player.id === me?.playerId}
            // Away players keep their seat and squares (protocol 2); the
            // chip dims and says "away" rather than vanishing (pass 02 `12c`).
            connected={player.connected}
            // Where they are this round: a word and a glyph (pass 03 note 6).
            {...(inGame ? { status: playerStatus(snapshot, player.id) } : {})}
            // D9: in an own-board game other players show how far along they
            // are — a number on the chip, never their board. In a same-board
            // game everyone fills the same picture, so the number would only
            // repeat what "placing" and "done" already say (pass 03 `12b`
            // against `12d`).
            {...(inGame && snapshot.mode === 'own-board' && player.id !== me?.playerId
              ? completionProp(boardCompletion(snapshot, player.id))
              : {})}
          />
        ))}
    </>
  );
}

function completionProp(completion: number | null): { completion?: number } {
  return completion === null ? {} : { completion };
}
