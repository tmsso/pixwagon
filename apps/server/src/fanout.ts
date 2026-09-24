/**
 * Send one payload to every socket, never letting one dead socket stop the
 * rest. `WebSocket.send()` throws once a socket is closed ("Can't call
 * WebSocket send() after close()"), and `getWebSockets()` can still return a
 * socket that is mid-close — notably the one whose `webSocketClose` handler
 * is running, which that handler has just closed to echo the handshake.
 * Without the per-socket guard, that first throw aborted the loop and every
 * player after it in the list missed the message (found 2026-09-24: a
 * leaver's presence update and the round it closed never reached the room).
 */
export function sendToAll(
  sockets: Iterable<{ send(payload: string): void }>,
  payload: string,
): void {
  for (const socket of sockets) {
    try {
      socket.send(payload);
    } catch {
      // Closed or closing — its own close handler reconciles it.
    }
  }
}
