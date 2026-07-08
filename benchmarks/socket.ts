import { io, type Socket } from 'socket.io-client';
import {
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  WS_EVENTS,
  type RoomDiff,
  type RoomSnapshot,
  type SyncAck,
  type SyncBroadcast,
  type SyncCommand,
} from '@vdt/shared';
import {
  parseArgs,
  getList,
  getNumber,
  getNumberList,
  getOptionalString,
  getString,
} from './lib/cli.js';
import { createBenchmarkElement } from './lib/elements.js';
import {
  approximateBytes,
  defaultResultPath,
  nowMs,
  sleep,
  summarizeLatencies,
  writeBenchmarkResult,
} from './lib/metrics.js';
import { disconnectSeedDb, seedBenchmarkRooms } from './lib/seed.js';

type SocketScenario =
  | 'hot-room'
  | 'multi-room'
  | 'cursor-noise'
  | 'reconnect-diff'
  | 'connection-storm';

interface SocketMetrics {
  clients: number;
  rooms: number;
  editors: number;
  viewers: number;
  joins: {
    success: number;
    failed: number;
    accessErrors: number;
    latencyMs: ReturnType<typeof summarizeLatencies>;
  };
  updates: {
    sent: number;
    acked: number;
    rejected: number;
    broadcasts: number;
    ackLatencyMs: ReturnType<typeof summarizeLatencies>;
    broadcastLatencyMs: ReturnType<typeof summarizeLatencies>;
  };
  reconnect: { attempts: number; ready: number; latencyMs: ReturnType<typeof summarizeLatencies> };
  payloadBytesApprox: number;
  roomDiffCount: number;
  roomSnapshotCount: number;
  disconnects: number;
  errors: number;
  throughputEventsPerSec: number;
  convergence: { ok: boolean; reason: string };
}

interface BenchClient {
  index: number;
  roomId: string;
  role: 'editor' | 'viewer';
  sessionId: string;
  socket: Socket;
  joinedAt: number;
  lastServerClock: number;
  roomEpoch: number;
}

const args = parseArgs();
const scenario = getString(args, 'scenario', 'hot-room') as SocketScenario;
const target = getString(args, 'target', 'http://localhost:3001');
const roomCount = getNumber(args, 'rooms', scenario === 'multi-room' ? 4 : 1);
const clientsPerRoom = getNumber(args, 'clients-per-room', 10);
const durationMs = getNumber(args, 'duration-ms', getNumber(args, 'duration', 10) * 1000);
const updateRate = getNumber(args, 'update-rate', 2);
const editorRatio = Math.min(1, Math.max(0, getNumber(args, 'editor-ratio', 0.35)));
const elementCount = getNumber(args, 'element-count', 1000);
const outputPath = getString(args, 'output', defaultResultPath('socket', scenario));
const roomIdsArg = getList(args, 'room-ids', []);
const rampLevels = getNumberList(args, 'ramp', []);
const authToken = getOptionalString(args, 'auth-token');
const prefix = getString(args, 'prefix', `bench-${Date.now()}`);
const stopErrorRate = getNumber(args, 'stop-error-rate', 0.15);

void main();

async function main(): Promise<void> {
  if (rampLevels.length > 0) {
    const rampResults: Record<string, unknown>[] = [];
    for (const level of rampLevels) {
      const perRoom = Math.max(1, Math.ceil(level / roomCount));
      const result = await runOnce(perRoom);
      rampResults.push(result.metrics);
      const failures = result.metrics.joins.failed + result.metrics.errors;
      const errorRate = failures / Math.max(1, result.metrics.clients);
      if (errorRate > stopErrorRate) break;
    }
    await writeBenchmarkResult(outputPath, {
      kind: 'socket',
      scenario: `${scenario}-ramp`,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      target,
      options: { roomCount, rampLevels, durationMs, updateRate, editorRatio },
      metrics: { rampResults },
      notes: ['Ramp stops when join/error rate exceeds stop-error-rate.'],
    });
    return;
  }

  const result = await runOnce(clientsPerRoom);
  await writeBenchmarkResult(outputPath, result);
  console.log(`Socket benchmark wrote ${outputPath}`);
}

async function runOnce(perRoom: number) {
  const startedAt = new Date();
  const seed = await seedBenchmarkRooms({
    roomIds: roomIdsArg,
    roomCount,
    prefix,
    cleanup: true,
  });
  const metricsState = createMetricsState();
  const clients = await connectClients(seed.roomIds, perRoom, metricsState);

  if (scenario === 'reconnect-diff') {
    await runReconnectDiff(clients, metricsState);
  } else if (scenario === 'connection-storm') {
    await runConnectionStorm(clients, metricsState);
  } else if (scenario === 'cursor-noise') {
    await runCursorNoise(clients, metricsState);
  } else {
    await runUpdateLoad(clients, metricsState);
  }

  for (const client of clients) client.socket.disconnect();
  await disconnectSeedDb();
  const elapsedSeconds = Math.max(1, (nowMs() - metricsState.startedAtMs) / 1000);
  const metrics = finalizeMetrics(metricsState, clients, elapsedSeconds, seed.roomIds.length);
  return {
    kind: 'socket' as const,
    scenario,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    target,
    options: {
      authMode: seed.authMode,
      roomIds: seed.roomIds,
      clientsPerRoom: perRoom,
      durationMs,
      updateRate,
      editorRatio,
      elementCount,
    },
    metrics,
    notes: seed.notes,
  };
}

async function connectClients(
  roomIds: string[],
  perRoom: number,
  state: MetricsState,
): Promise<BenchClient[]> {
  const clients: BenchClient[] = [];
  const total = roomIds.length * perRoom;
  await Promise.all(
    roomIds.flatMap((roomId, roomIndex) =>
      Array.from({ length: perRoom }, async (_, localIndex) => {
        const index = roomIndex * perRoom + localIndex;
        const role = index / total < editorRatio ? 'editor' : 'viewer';
        const client = await connectOne(index, roomId, role, state, 0, 0);
        clients.push(client);
      }),
    ),
  );
  return clients.sort((a, b) => a.index - b.index);
}

function connectOne(
  index: number,
  roomId: string,
  role: BenchClient['role'],
  state: MetricsState,
  lastServerClock: number,
  roomEpoch: number,
): Promise<BenchClient> {
  const joinedAt = nowMs();
  const sessionId = `bench-session-${index}-${Math.random().toString(36).slice(2)}`;
  const socket = io(target, {
    auth: authToken ? { accessToken: authToken } : undefined,
    reconnection: false,
    transports: ['websocket'],
  });

  const client: BenchClient = {
    index,
    roomId,
    role,
    sessionId,
    socket,
    joinedAt,
    lastServerClock,
    roomEpoch,
  };
  wireClient(client, state);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      state.joinFailures += 1;
      resolve(client);
    }, 8000);
    socket.on('connect', () => {
      socket.emit(WS_EVENTS.JOIN_ROOM, {
        roomId,
        sessionId,
        name: `Bench ${index}`,
        color: '#2563eb',
        lastServerClock,
        roomEpoch,
        pendingRequests: [],
      });
    });
    socket.once(WS_EVENTS.ROOM_SNAPSHOT, (payload: RoomSnapshot) => {
      clearTimeout(timeout);
      client.lastServerClock = payload.serverClock;
      client.roomEpoch = payload.roomEpoch;
      state.joinSuccess += 1;
      state.joinLatencies.push(nowMs() - joinedAt);
      state.snapshotCount += 1;
      state.payloadBytes += approximateBytes(payload);
      resolve(client);
    });
    socket.once(WS_EVENTS.ROOM_DIFF, (payload: RoomDiff) => {
      clearTimeout(timeout);
      client.lastServerClock = payload.serverClock;
      client.roomEpoch = payload.roomEpoch;
      state.joinSuccess += 1;
      state.joinLatencies.push(nowMs() - joinedAt);
      state.diffCount += 1;
      state.payloadBytes += approximateBytes(payload);
      resolve(client);
    });
  });
}

function wireClient(client: BenchClient, state: MetricsState): void {
  client.socket.on(WS_EVENTS.ROOM_ACCESS_ERROR, () => {
    state.accessErrors += 1;
  });
  client.socket.on('disconnect', () => {
    state.disconnects += 1;
  });
  client.socket.on('connect_error', () => {
    state.errors += 1;
  });
  client.socket.on(WS_EVENTS.SYNC_ACK, (ack: SyncAck) => {
    const sentAt = state.sentAtByRequestId.get(ack.requestId);
    if (sentAt !== undefined) state.ackLatencies.push(nowMs() - sentAt);
    if (ack.status === 'reject') state.rejected += 1;
    else state.acked += 1;
    client.lastServerClock = Math.max(client.lastServerClock, ack.serverClock);
  });
  client.socket.on(WS_EVENTS.SYNC_BROADCAST, (broadcast: SyncBroadcast) => {
    state.broadcasts += 1;
    state.payloadBytes += approximateBytes(broadcast);
    client.lastServerClock = Math.max(client.lastServerClock, broadcast.serverClock);
    const sentAt = state.sentAtByRequestId.get(broadcast.changeSet.requestId);
    if (sentAt !== undefined) state.broadcastLatencies.push(nowMs() - sentAt);
  });
  client.socket.on(WS_EVENTS.CURSOR_MOVE, (payload: unknown) => {
    state.payloadBytes += approximateBytes(payload);
    state.cursorBroadcasts += 1;
  });
}

async function runUpdateLoad(clients: BenchClient[], state: MetricsState): Promise<void> {
  const editors = clients.filter((client) => client.role === 'editor');
  const intervalMs = Math.max(10, 1000 / Math.max(1, updateRate));
  const endAt = nowMs() + durationMs;
  let sequence = 0;
  while (nowMs() < endAt) {
    for (const editor of editors) {
      sendCreate(editor, state, sequence);
      sequence += 1;
    }
    await sleep(intervalMs);
  }
  await sleep(1000);
}

async function runCursorNoise(clients: BenchClient[], state: MetricsState): Promise<void> {
  const intervalMs = Math.max(10, 1000 / Math.max(1, updateRate));
  const endAt = nowMs() + durationMs;
  let sequence = 0;
  while (nowMs() < endAt) {
    for (const client of clients) {
      client.socket.emit(WS_EVENTS.CURSOR_MOVE, {
        roomId: client.roomId,
        sessionId: client.sessionId,
        cursor: { x: sequence % 5000, y: (sequence * 7) % 3000 },
        viewport: { x: sequence % 1000, y: sequence % 700, zoom: 1 },
        selectedIds: [],
      });
      state.sent += 1;
      sequence += 1;
    }
    await sleep(intervalMs);
  }
  await sleep(500);
}

async function runReconnectDiff(clients: BenchClient[], state: MetricsState): Promise<void> {
  const probe = clients.find((client) => client.role === 'viewer') ?? clients[0];
  const editor = clients.find((client) => client.role === 'editor') ?? clients[0];
  sendCreate(editor, state, -1);
  for (let attempt = 0; attempt < 20 && probe.lastServerClock === 0; attempt += 1) {
    await sleep(50);
  }
  const fromClock = probe.lastServerClock;
  const roomEpoch = probe.roomEpoch;
  probe.socket.disconnect();
  for (let index = 0; index < elementCount; index += 1) {
    sendCreate(editor, state, index);
  }
  await sleep(1000);
  state.reconnectAttempts += 1;
  const start = nowMs();
  const reconnected = await connectOne(
    probe.index,
    probe.roomId,
    probe.role,
    state,
    fromClock,
    roomEpoch,
  );
  if (reconnected.lastServerClock > fromClock) {
    state.reconnectReady += 1;
    state.reconnectLatencies.push(nowMs() - start);
  }
  reconnected.socket.disconnect();
}

async function runConnectionStorm(clients: BenchClient[], state: MetricsState): Promise<void> {
  const snapshots = clients.map((client) => ({
    index: client.index,
    roomId: client.roomId,
    role: client.role,
    clock: client.lastServerClock,
    epoch: client.roomEpoch,
  }));
  for (const client of clients) client.socket.disconnect();
  await sleep(500);
  state.reconnectAttempts += snapshots.length;
  const start = nowMs();
  await Promise.all(
    snapshots.map(async (snapshot) => {
      const client = await connectOne(
        snapshot.index,
        snapshot.roomId,
        snapshot.role,
        state,
        snapshot.clock,
        snapshot.epoch,
      );
      state.reconnectReady += 1;
      state.reconnectLatencies.push(nowMs() - start);
      client.socket.disconnect();
    }),
  );
}

function sendCreate(client: BenchClient, state: MetricsState, sequence: number): void {
  const command: SyncCommand = {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    kind: 'create-element',
    roomId: client.roomId,
    requestId: `bench-${client.index}-${sequence}-${Date.now()}`,
    clientClock: client.lastServerClock,
    baseRoomEpoch: client.roomEpoch,
    persistence: { durability: 'durable', resendable: true, storeProcessedRequest: true },
    element: createBenchmarkElement(sequence, `bench-${client.index}`),
    orderHint: { baseOrderClock: 0 },
  };
  state.sent += 1;
  state.sentAtByRequestId.set(command.requestId, nowMs());
  state.payloadBytes += approximateBytes(command);
  client.socket.emit(WS_EVENTS.SYNC_COMMAND, command);
}

interface MetricsState {
  startedAtMs: number;
  joinSuccess: number;
  joinFailures: number;
  accessErrors: number;
  sent: number;
  acked: number;
  rejected: number;
  broadcasts: number;
  cursorBroadcasts: number;
  diffCount: number;
  snapshotCount: number;
  disconnects: number;
  errors: number;
  reconnectAttempts: number;
  reconnectReady: number;
  payloadBytes: number;
  joinLatencies: number[];
  ackLatencies: number[];
  broadcastLatencies: number[];
  reconnectLatencies: number[];
  sentAtByRequestId: Map<string, number>;
}

function createMetricsState(): MetricsState {
  return {
    startedAtMs: nowMs(),
    joinSuccess: 0,
    joinFailures: 0,
    accessErrors: 0,
    sent: 0,
    acked: 0,
    rejected: 0,
    broadcasts: 0,
    cursorBroadcasts: 0,
    diffCount: 0,
    snapshotCount: 0,
    disconnects: 0,
    errors: 0,
    reconnectAttempts: 0,
    reconnectReady: 0,
    payloadBytes: 0,
    joinLatencies: [],
    ackLatencies: [],
    broadcastLatencies: [],
    reconnectLatencies: [],
    sentAtByRequestId: new Map(),
  };
}

function finalizeMetrics(
  state: MetricsState,
  clients: BenchClient[],
  elapsedSeconds: number,
  rooms: number,
): SocketMetrics {
  const editors = clients.filter((client) => client.role === 'editor').length;
  const expectedAcks = scenario === 'cursor-noise' ? 0 : state.sent;
  const enoughAcks =
    expectedAcks === 0 || state.acked + state.rejected >= Math.floor(expectedAcks * 0.9);
  const ok =
    enoughAcks && state.accessErrors === 0 && state.rejected === 0 && state.joinSuccess > 0;
  return {
    clients: clients.length,
    rooms,
    editors,
    viewers: clients.length - editors,
    joins: {
      success: state.joinSuccess,
      failed: state.joinFailures,
      accessErrors: state.accessErrors,
      latencyMs: summarizeLatencies(state.joinLatencies),
    },
    updates: {
      sent: state.sent,
      acked: state.acked,
      rejected: state.rejected,
      broadcasts: state.broadcasts + state.cursorBroadcasts,
      ackLatencyMs: summarizeLatencies(state.ackLatencies),
      broadcastLatencyMs: summarizeLatencies(state.broadcastLatencies),
    },
    reconnect: {
      attempts: state.reconnectAttempts,
      ready: state.reconnectReady,
      latencyMs: summarizeLatencies(state.reconnectLatencies),
    },
    payloadBytesApprox: state.payloadBytes,
    roomDiffCount: state.diffCount,
    roomSnapshotCount: state.snapshotCount,
    disconnects: state.disconnects,
    errors: state.errors,
    throughputEventsPerSec: Math.round(
      (state.sent + state.broadcasts + state.cursorBroadcasts) / elapsedSeconds,
    ),
    convergence: {
      ok,
      reason: ok
        ? 'All joins succeeded and update acks reached the expected smoke threshold.'
        : 'Run did not converge cleanly; inspect access errors, rejected updates, and join failures.',
    },
  };
}
