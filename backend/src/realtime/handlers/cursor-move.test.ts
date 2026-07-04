import type { Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import { describe, expect, it, vi } from 'vitest';
import { handleCursorMove } from './cursor-move.js';

describe('handleCursorMove', () => {
  it('relays cursor updates to the joined room', () => {
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    const socket = { data: { roomId: 'room-1' }, to } as unknown as Socket;

    handleCursorMove(socket, {
      roomId: 'room-1',
      sessionId: 'session-1',
      cursor: { x: 1, y: 2 },
      selectedIds: [],
    });

    expect(to).toHaveBeenCalledWith('room-1');
    expect(emit).toHaveBeenCalledWith(WS_EVENTS.CURSOR_MOVE, expect.objectContaining({
      sessionId: 'session-1',
    }));
  });

  it('drops cursor updates for a room the socket has not joined', () => {
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    const socket = { data: { roomId: 'room-1' }, to } as unknown as Socket;

    handleCursorMove(socket, {
      roomId: 'room-2',
      sessionId: 'session-1',
      cursor: { x: 1, y: 2 },
      selectedIds: [],
    });

    expect(to).not.toHaveBeenCalled();
  });
});
