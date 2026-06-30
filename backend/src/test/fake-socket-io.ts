import { vi } from 'vitest';

export interface FakeSocket {
  id: string;
  data: { sessionId: string; roomId: string };
  join: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  to: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

type ConnectionHandler = (socket: FakeSocket) => void;

interface MakeSocketOptions {
  roomId?: string;
  sessionId?: string;
  socketId?: string;
}

export function makeFakeIo() {
  let connectionHandler: ConnectionHandler | null = null;
  const broadcastEmitted: Array<[string, unknown]> = [];

  const roomEmit = vi.fn((event: string, payload: unknown) => {
    broadcastEmitted.push([event, payload]);
  });
  const peerEmit = vi.fn((event: string, payload: unknown) => {
    broadcastEmitted.push([event, payload]);
  });
  const toReturn = { emit: roomEmit };
  const peerReturn = { emit: peerEmit };

  const ioServer = {
    on: vi.fn((event: string, handler: ConnectionHandler) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    }),
    to: vi.fn().mockReturnValue(toReturn),
  };

  function makeSocket(options: MakeSocketOptions = {}): FakeSocket {
    return {
      id: options.socketId ?? 'socket-1',
      data: {
        sessionId: options.sessionId ?? '',
        roomId: options.roomId ?? '',
      },
      join: vi.fn(),
      emit: vi.fn(),
      to: vi.fn().mockReturnValue(peerReturn),
      on: vi.fn(),
    };
  }

  function connect(socket: FakeSocket): void {
    if (!connectionHandler) throw new Error('connection handler not registered');
    connectionHandler(socket);
  }

  function getHandler(socket: FakeSocket, event: string) {
    const onCalls = socket.on.mock.calls as Array<[string, (...args: unknown[]) => unknown]>;
    const entry = onCalls.find((call) => call[0] === event);
    if (!entry) throw new Error(`No handler registered for '${event}'`);
    return entry[1];
  }

  return {
    ioServer,
    makeSocket,
    connect,
    getHandler,
    toReturn,
    peerEmit,
    roomEmit,
    broadcastEmitted,
  };
}
