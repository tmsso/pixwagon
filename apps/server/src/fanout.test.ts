import { describe, expect, it } from 'vitest';
import { sendToAll } from './fanout.ts';

describe('sendToAll', () => {
  it('still reaches every live socket when one earlier in the list throws', () => {
    const received: string[] = [];
    const closed = {
      send() {
        throw new TypeError("Can't call WebSocket send() after close().");
      },
    };
    const live = (name: string) => ({ send: (p: string) => received.push(`${name}:${p}`) });

    sendToAll([closed, live('a'), closed, live('b')], 'hello');

    expect(received).toEqual(['a:hello', 'b:hello']);
  });
});
