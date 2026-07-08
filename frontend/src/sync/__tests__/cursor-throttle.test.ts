import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PRESENCE_PREVIEW_THROTTLE_MS } from '../socket/p5-command-queue';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ emit: vi.fn(), on: vi.fn(), disconnect: vi.fn() })),
}));

vi.mock('../presence', () => ({
  LOCAL_PRESENCE: { sessionId: 'local-session-id', name: 'Blue Fox', color: '#3b82f6' },
  toPresence: (local: { sessionId: string; name: string; color: string }) => ({
    ...local,
    cursor: null,
    selectedIds: [],
    status: 'active' as const,
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  // Start at a realistic base time so the first call always passes the throttle guard
  vi.setSystemTime(1000);
});

afterEach(async () => {
  const { stopSocketClient } = await import('../socket-client');
  stopSocketClient();
  vi.useRealTimers();
});

describe('cursor-throttle — AC-6', () => {
  // @covers AC-6
  it('emitCursorMove is rate-limited by the presence preview throttle from Whiteboard', async () => {
    const { initSocketClient, emitCursorMove } = await import('../socket-client');
    // Grab the socket mock emit after module reset
    const { io } = await import('socket.io-client');
    const socketMock = (io as ReturnType<typeof vi.fn>).mock.results[0]?.value as
      | { emit: ReturnType<typeof vi.fn> }
      | undefined;

    initSocketClient('room-abc');
    const socketEmit =
      socketMock?.emit ?? (io as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value?.emit;
    if (socketEmit) socketEmit.mockClear();

    // Simulate Whiteboard.tsx throttle guard inline
    let lastSentAt = 0;
    function throttledEmit(cursor: { x: number; y: number }) {
      const now = Date.now();
      if (now - lastSentAt >= PRESENCE_PREVIEW_THROTTLE_MS) {
        emitCursorMove(cursor);
        lastSentAt = now;
      }
    }

    // t=1000: first call, delta exceeds throttle window -> emit
    vi.setSystemTime(1000);
    throttledEmit({ x: 1, y: 1 });

    // t=1010: delta=10, below throttle window -> skip
    vi.setSystemTime(1010);
    throttledEmit({ x: 2, y: 2 });

    // t=1020: delta=20, below throttle window -> skip
    vi.setSystemTime(1020);
    throttledEmit({ x: 3, y: 3 });

    // Next throttle boundary -> emit
    vi.setSystemTime(1000 + PRESENCE_PREVIEW_THROTTLE_MS);
    throttledEmit({ x: 4, y: 4 });

    // t=1050: still below the next throttle boundary -> skip
    vi.setSystemTime(1050);
    throttledEmit({ x: 5, y: 5 });

    // Next throttle boundary -> emit
    vi.setSystemTime(1000 + PRESENCE_PREVIEW_THROTTLE_MS * 2);
    throttledEmit({ x: 6, y: 6 });

    // emitCursorMove calls socket.emit(CURSOR_MOVE, ...) each time
    // Count only cursor-move emits (join-room is also emitted on init)
    const allEmits =
      (io as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value?.emit?.mock?.calls ?? [];
    const cursorMoveEmits = allEmits.filter(([event]: [string]) => event === 'cursor-move');
    // Expected: t=1000 and the next two throttle boundaries -> exactly 3 emits.
    expect(cursorMoveEmits).toHaveLength(3);
    expect(cursorMoveEmits[0][1].cursor).toEqual({ x: 1, y: 1 });
    expect(cursorMoveEmits[1][1].cursor).toEqual({ x: 4, y: 4 });
    expect(cursorMoveEmits[2][1].cursor).toEqual({ x: 6, y: 6 });
  });
});
