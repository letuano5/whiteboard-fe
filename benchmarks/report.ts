import { writeFile } from 'node:fs/promises';
import { getString, parseArgs } from './lib/cli.js';
import { readBenchmarkResults, type BenchmarkEnvelope } from './lib/metrics.js';

const args = parseArgs();
const outputPath = getString(args, 'output', 'docs/benchmark-report.md');

void main();

async function main(): Promise<void> {
  const results = await readBenchmarkResults();
  const socketResults = results.filter((result) => result.kind === 'socket');
  const renderResults = results.filter((result) => result.kind === 'render');
  const httpResults = results.filter((result) => result.kind === 'http');
  const content = [
    '# Benchmark Report',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '## How to run',
    '',
    '```bash',
    'pnpm benchmark:socket -- --target=http://localhost:3001 --scenario=hot-room --clients-per-room=10 --duration=10',
    'pnpm benchmark:socket -- --target=http://localhost:3001 --scenario=reconnect-diff --clients-per-room=10 --element-count=1000',
    'pnpm benchmark:http -- --target=http://localhost:3001 --concurrency=10,50,100 --auth-token=<token> --room-ids=<room-id>',
    'pnpm benchmark:render -- --target=http://127.0.0.1:5173 --elements=1000,5000,10000 --scenarios=render,pan-zoom',
    'pnpm benchmark:report',
    '```',
    '',
    '## Targets',
    '',
    '- Backend local: `http://localhost:3001`',
    '- Backend VPS: `https://api.34.46.13.22.nip.io/`',
    '- Frontend local: `http://localhost:5173` or `http://127.0.0.1:5173`',
    '- Frontend GitHub Pages smoke: `https://letuano5.github.io/whiteboard-fe/`',
    '',
    'Socket/backend load should target the backend directly. GitHub Pages is for render smoke only.',
    '',
    '## Auth And Seed Mode',
    '',
    'Socket benchmarks seed local rooms through Prisma when `DATABASE_URL` is available. Seeded rooms use the `bench-*` prefix and `link_edit` visibility so anonymous benchmark sockets can edit without production auth. For VPS runs, pass existing `--room-ids` and `--auth-token` when production auth is required; if production seeding is unavailable, run local seeded mode and document the VPS limitation.',
    '',
    'HTTP benchmarks use `--auth-token` for protected routes. Without a token they still run, but protected endpoints are expected to report 401/403/404.',
    '',
    '## Socket Results',
    '',
    socketTable(socketResults),
    '',
    '## Render Results',
    '',
    renderTable(renderResults),
    '',
    '## HTTP Results',
    '',
    httpTable(httpResults),
    '',
    '## Limits And Bottlenecks',
    '',
    '- Ramp high socket loads with `--ramp=10,50,100,1000,10000`; stop automatically when the join/error rate exceeds `--stop-error-rate`.',
    '- 1k and 10k socket clients are supported by the harness, but should only be run after the 10/50/100 smoke levels pass on the target machine.',
    '- Render benchmark measures SVG/DOM cost in Chromium. It does not replace manual UX inspection for selection/toolbar behavior.',
    '- HTTP runner focuses on important GET endpoints and intentionally avoids destructive document mutations.',
    '',
    '## Recommendations',
    '',
    '- Keep a small committed smoke baseline in `benchmark-results/` after meaningful sync/render changes.',
    '- Run `reconnect-diff` before changing tombstone, diff, or room epoch code.',
    '- Run render 1k/5k/10k before adding new SVG shape rendering behavior.',
    '',
  ].join('\n');

  await writeFile(outputPath, content, 'utf8');
  console.log(`Benchmark report wrote ${outputPath}`);
}

function socketTable(results: BenchmarkEnvelope<Record<string, unknown>>[]): string {
  if (results.length === 0) return '_No socket benchmark results found._';
  const rows = results.map((result) => {
    const metrics = result.metrics as Record<string, unknown>;
    if ('rampResults' in metrics) {
      return `| ${result.scenario} | ${result.target} | ramp | - | - | - | - | - |`;
    }
    const joins = readRecord(metrics.joins);
    const updates = readRecord(metrics.updates);
    const reconnect = readRecord(metrics.reconnect);
    const joinLatency = readRecord(joins.latencyMs);
    const ackLatency = readRecord(updates.ackLatencyMs);
    const reconnectLatency = readRecord(reconnect.latencyMs);
    return (
      [
        `| ${result.scenario}`,
        result.target,
        String(metrics.clients ?? '-'),
        String(joins.success ?? '-'),
        String(joins.accessErrors ?? '-'),
        String(ackLatency.p95 ?? '-'),
        String(reconnectLatency.p95 ?? '-'),
        String(metrics.throughputEventsPerSec ?? '-'),
      ].join(' | ') + ' |'
    );
  });
  return [
    '| Scenario | Target | Clients | Join OK | Access Errors | Ack p95 ms | Reconnect p95 ms | Events/sec |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...rows,
  ].join('\n');
}

function renderTable(results: BenchmarkEnvelope<Record<string, unknown>>[]): string {
  const runs = results.flatMap((result) => {
    const metrics = result.metrics as { runs?: unknown };
    return Array.isArray(metrics.runs)
      ? metrics.runs
          .map((run) => ({ target: result.target, run: readRecord(run) }))
          .filter(({ run }) => Number(run.elementCount ?? 0) >= 1000)
      : [];
  });
  if (runs.length === 0) return '_No render benchmark results found._';
  return [
    '| Target | Scenario | Elements | First render ms | Frame p95 ms | Long tasks | SVG nodes |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...runs.map(
      ({ target, run }) =>
        `| ${target} | ${run.scenario ?? '-'} | ${run.elementCount ?? '-'} | ${run.timeToFirstRenderMs ?? '-'} | ${run.p95FrameTimeMs ?? '-'} | ${run.longTaskCount ?? '-'} | ${run.svgNodeCount ?? '-'} |`,
    ),
  ].join('\n');
}

function httpTable(results: BenchmarkEnvelope<Record<string, unknown>>[]): string {
  const endpoints = results.flatMap((result) => {
    const metrics = result.metrics as { endpoints?: unknown };
    return Array.isArray(metrics.endpoints)
      ? metrics.endpoints.map((endpoint) => ({
          target: result.target,
          endpoint: readRecord(endpoint),
        }))
      : [];
  });
  if (endpoints.length === 0) return '_No HTTP benchmark results found._';
  return [
    '| Target | Endpoint | Concurrency | Requests | Error rate | p95 ms | Bytes |',
    '|---|---|---:|---:|---:|---:|---:|',
    ...endpoints.map(({ target, endpoint }) => {
      const latency = readRecord(endpoint.latencyMs);
      return `| ${target} | ${endpoint.endpoint ?? '-'} | ${endpoint.concurrency ?? '-'} | ${endpoint.requests ?? '-'} | ${formatRate(endpoint.errorRate)} | ${latency.p95 ?? '-'} | ${endpoint.payloadBytesApprox ?? '-'} |`;
    }),
  ].join('\n');
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function formatRate(value: unknown): string {
  return typeof value === 'number' ? `${Math.round(value * 1000) / 10}%` : '-';
}
