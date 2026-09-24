import { describe, expect, it } from 'vitest';
import { createRoomUrl, resolveRoomOrigin, roomSocketUrl } from './roomOrigin.ts';

describe('resolveRoomOrigin', () => {
  it('prefers an explicit VITE_ROOM_ORIGIN, trimming a trailing slash', () => {
    expect(resolveRoomOrigin({ VITE_ROOM_ORIGIN: 'https://example.test/', DEV: true })).toBe(
      'https://example.test',
    );
  });

  it('falls back to local wrangler dev under pnpm dev', () => {
    expect(resolveRoomOrigin({ DEV: true })).toBe('http://localhost:8787');
  });

  it('falls back to the live worker in a production build', () => {
    expect(resolveRoomOrigin({ DEV: false })).toBe('https://pixwagon-app.tmsso.workers.dev');
    expect(resolveRoomOrigin({ VITE_ROOM_ORIGIN: '  ' })).toBe(
      'https://pixwagon-app.tmsso.workers.dev',
    );
  });
});

describe('room URLs', () => {
  it('builds the create-room endpoint on the worker origin', () => {
    expect(createRoomUrl('https://w.test')).toBe('https://w.test/api/room');
  });

  it('swaps https for wss and http for ws on the socket URL', () => {
    expect(roomSocketUrl('pixw', 'https://w.test')).toBe('wss://w.test/api/room/PIXW/ws');
    expect(roomSocketUrl('PIXW', 'http://localhost:8787')).toBe(
      'ws://localhost:8787/api/room/PIXW/ws',
    );
  });
});
