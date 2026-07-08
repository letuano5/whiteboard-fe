import {
  parseArgs,
  getBoolean,
  getList,
  getNumber,
  getNumberList,
  getOptionalString,
  getString,
} from './lib/cli.js';
import {
  approximateBytes,
  defaultResultPath,
  nowMs,
  summarizeLatencies,
  writeBenchmarkResult,
} from './lib/metrics.js';
import { disconnectSeedDb, seedBenchmarkRooms } from './lib/seed.js';

interface EndpointMetrics {
  endpoint: string;
  concurrency: number;
  requests: number;
  errors: number;
  errorRate: number;
  payloadBytesApprox: number;
  latencyMs: ReturnType<typeof summarizeLatencies>;
  statusCounts: Record<string, number>;
}

const args = parseArgs();
const target = getString(args, 'target', 'http://localhost:3001').replace(/\/$/, '');
const roomIdsArg = getList(args, 'room-ids', []);
const authToken = getOptionalString(args, 'auth-token') ?? process.env.BENCHMARK_AUTH_TOKEN;
const outputPath = getString(args, 'output', defaultResultPath('http', 'get-endpoints'));
const concurrencies = getNumberList(args, 'concurrency', [10, 50, 100]);
const requestsPerConcurrency = Number(getString(args, 'requests', '100'));
const seedRooms = getBoolean(args, 'seed', roomIdsArg.length === 0);
const prefix = getString(args, 'prefix', `bench-http-${Date.now()}`);
const roomCount = getNumber(args, 'rooms', 1);

void main();

async function main(): Promise<void> {
  const startedAt = new Date();
  const seed = seedRooms
    ? await seedBenchmarkRooms({ roomIds: roomIdsArg, roomCount, prefix, cleanup: true })
    : { roomIds: roomIdsArg, authMode: 'provided-room-ids' as const, notes: [] };
  const roomIds = seed.roomIds;
  const endpoints = buildEndpoints(roomIds);
  const results: EndpointMetrics[] = [];

  for (const concurrency of concurrencies) {
    for (const endpoint of endpoints) {
      results.push(await runEndpoint(endpoint, concurrency));
    }
  }

  await writeBenchmarkResult(outputPath, {
    kind: 'http',
    scenario: 'get-endpoints',
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    target,
    options: {
      authMode: authToken ? 'bearer-token' : 'none',
      seedMode: seed.authMode,
      roomIds,
      concurrencies,
      requestsPerConcurrency,
    },
    metrics: { endpoints: results },
    notes: [
      ...seed.notes,
      authToken
        ? 'HTTP requests used the provided bearer token.'
        : 'No bearer token was provided; protected endpoints may report 401/404.',
    ],
  });
  await disconnectSeedDb();
  console.log(`HTTP benchmark wrote ${outputPath}`);
}

function buildEndpoints(ids: string[]): string[] {
  const firstRoomId = ids[0] ?? ':roomId';
  return [
    '/api/documents?limit=24',
    `/api/rooms/${firstRoomId}/access`,
    `/api/rooms/${firstRoomId}/export-native`,
    `/api/rooms/${firstRoomId}/snapshots`,
  ];
}

async function runEndpoint(endpoint: string, concurrency: number): Promise<EndpointMetrics> {
  const latencies: number[] = [];
  const statusCounts: Record<string, number> = {};
  let errors = 0;
  let payloadBytesApprox = 0;
  let launched = 0;

  async function worker(): Promise<void> {
    while (launched < requestsPerConcurrency) {
      launched += 1;
      const started = nowMs();
      try {
        const response = await fetch(`${target}${endpoint}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        });
        const body = await response.text();
        payloadBytesApprox += Buffer.byteLength(body, 'utf8');
        statusCounts[String(response.status)] = (statusCounts[String(response.status)] ?? 0) + 1;
        if (!response.ok) errors += 1;
      } catch {
        errors += 1;
        statusCounts.network = (statusCounts.network ?? 0) + 1;
      } finally {
        latencies.push(nowMs() - started);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return {
    endpoint,
    concurrency,
    requests: latencies.length,
    errors,
    errorRate: errors / Math.max(1, latencies.length),
    payloadBytesApprox: payloadBytesApprox + approximateBytes(statusCounts),
    latencyMs: summarizeLatencies(latencies),
    statusCounts,
  };
}
