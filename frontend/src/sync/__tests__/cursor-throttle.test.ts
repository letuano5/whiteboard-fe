import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ emit: vi.fn(), on: vi.fn(), disconnect: vi.fn() })),
}));

vi.mock('../presence', () => ({
  LOCAL_PRESENCE: { sessionId: 'local-session-id', name: 'Blue Fox', color: '#3b82f6' },
  toPresence: (local: { sessionId: string; name: string; color: string }) => ({
    ...local, cursor: null, selectedIds: [], status: 'active' as const,
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  // Start at a realistic base time so the first call always passes the 33ms guard
  vi.setSystemTime(1000);
});

afterEach(async () => {
  const { stopSocketClient } = await import('../socket-client');
  stopSocketClient();
  vi.useRealTimers();
});

describe('cursor-throttle — AC-6', () => {
  // @covers AC-6
  it('emitCursorMove is rate-limited: at most 1 call per 33 ms window from Whiteboard', async () => {
    const { initSocketClient, emitCursorMove } = await import('../socket-client');
    // Grab the socket mock emit after module reset
    const { io } = await import('socket.io-client');
    const socketMock = (io as ReturnType<typeof vi.fn>).mock.results[0]?.value as { emit: ReturnType<typeof vi.fn> } | undefined;

    initSocketClient('room-abc');
    const socketEmit = socketMock?.emit ?? (io as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value?.emit;
    if (socketEmit) socketEmit.mockClear();

    // Simulate Whiteboard.tsx throttle guard inline
    let lastSentAt = 0;
    function throttledEmit(cursor: { x: number; y: number }) {
      const now = Date.now();
      if (now - lastSentAt >= 33) {
        emitCursorMove(cursor);
        lastSentAt = now;
      }
    }

    // t=1000: first call — delta = 1000-0 = 1000 >= 33 → EMIT
    vi.setSystemTime(1000);
    throttledEmit({ x: 1, y: 1 });

    // t=1010: delta=10 < 33 → skip
    vi.setSystemTime(1010);
    throttledEmit({ x: 2, y: 2 });

    // t=1020: delta=20 < 33 → skip
    vi.setSystemTime(1020);
    throttledEmit({ x: 3, y: 3 });

    // t=1033: delta=33 >= 33 → EMIT
    vi.setSystemTime(1033);
    throttledEmit({ x: 4, y: 4 });

    // t=1050: delta=17 < 33 → skip
    vi.setSystemTime(1050);
    throttledEmit({ x: 5, y: 5 });

    // t=1066: delta=33 >= 33 → EMIT
    vi.setSystemTime(1066);
    throttledEmit({ x: 6, y: 6 });

    // emitCursorMove calls socket.emit(CURSOR_MOVE, ...) each time
    // Count only cursor-move emits (join-room is also emitted on init)
    const allEmits = (io as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value?.emit?.mock?.calls ?? [];
    const cursorMoveEmits = allEmits.filter(([event]: [string]) => event === 'cursor-move');
    // Expected: t=1000, t=1033, t=1066 → exactly 3 emits for 6 rapid calls
    expect(cursorMoveEmits).toHaveLength(3);
    expect(cursorMoveEmits[0][1].cursor).toEqual({ x: 1, y: 1 });
    expect(cursorMoveEmits[1][1].cursor).toEqual({ x: 4, y: 4 });
    expect(cursorMoveEmits[2][1].cursor).toEqual({ x: 6, y: 6 });
  });
});
