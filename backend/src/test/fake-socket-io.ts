import { vi } from 'vitest';
import type { AppUser, VerifiedIdentity } from '../auth/index.js';

export interface FakeSocket {
  id: string;
  data: {
    sessionId: string;
    roomId: string;
    auth?: {
      identity: VerifiedIdentity;
      user?: AppUser;
    };
    roomBaseRole?: string;
    roomRole?: string;
    roomRoleCapacityDowngraded?: boolean;
  };
  rooms: Set<string>;
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
  const sockets = new Map<string, FakeSocket>();

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
    use: vi.fn(),
    to: vi.fn().mockReturnValue(toReturn),
    sockets: {
      sockets,
    },
  };

  function makeSocket(options: MakeSocketOptions = {}): FakeSocket {
    const socketId = options.socketId ?? 'socket-1';
    const socket: FakeSocket = {
      id: socketId,
      data: {
        sessionId: options.sessionId ?? '',
        roomId: options.roomId ?? '',
      },
      rooms: new Set([socketId]),
      join: vi.fn((roomId: string) => {
        socket.rooms.add(roomId);
        socket.data.roomId = roomId;
      }),
      emit: vi.fn(),
      to: vi.fn().mockReturnValue(peerReturn),
      on: vi.fn(),
    };
    return socket;
  }

  function connect(socket: FakeSocket): void {
    if (!connectionHandler) throw new Error('connection handler not registered');
    sockets.set(socket.id, socket);
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
