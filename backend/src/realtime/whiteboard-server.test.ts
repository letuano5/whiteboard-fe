import { describe, expect, it, vi } from 'vitest';
import { WS_EVENTS } from '@vdt/shared';
import { makeFakeIo } from '../test/fake-socket-io.js';
import { createWhiteboardServer } from './whiteboard-server.js';

describe('createWhiteboardServer handler safety', () => {
  it('catches rejected async socket handlers and emits an error response', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();

    createWhiteboardServer(ioServer as unknown as Parameters<typeof createWhiteboardServer>[0], {
      roomPresence: new Map(),
    });

    const socket = makeSocket();
    connect(socket);

    const joinHandler = getHandler(socket, WS_EVENTS.JOIN_ROOM);
    await joinHandler(undefined);

    expect(socket.emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Realtime request could not be processed.',
    });
    consoleError.mockRestore();
  });

  it('catches synchronous socket handler throws and emits an error response', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ioServer, makeSocket, connect, getHandler } = makeFakeIo();

    createWhiteboardServer(ioServer as unknown as Parameters<typeof createWhiteboardServer>[0], {
      roomPresence: new Map(),
    });

    const socket = makeSocket({ roomId: 'room-1' });
    connect(socket);

    const cursorMoveHandler = getHandler(socket, WS_EVENTS.CURSOR_MOVE);
    await cursorMoveHandler(undefined);

    expect(socket.emit).toHaveBeenCalledWith(WS_EVENTS.ROOM_ACCESS_ERROR, {
      code: 'room-access/forbidden',
      message: 'Realtime request could not be processed.',
    });
    consoleError.mockRestore();
  });
});
