import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';

export interface LatencySummary {
  count: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  average: number;
}

export interface BenchmarkEnvelope<TMetrics extends Record<string, unknown>> {
  kind: 'socket' | 'http' | 'render' | 'report';
  scenario: string;
  startedAt: string;
  finishedAt: string;
  target: string;
  options: Record<string, unknown>;
  metrics: TMetrics;
  notes: string[];
}

export function summarizeLatencies(values: readonly number[]): LatencySummary {
  if (values.length === 0) {
    return { count: 0, min: 0, p50: 0, p95: 0, p99: 0, max: 0, average: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    count: sorted.length,
    min: round(sorted[0]),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(sorted[sorted.length - 1]),
    average: round(sum / sorted.length),
  };
}

export function percentile(sortedValues: readonly number[], percentileValue: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1),
  );
  return sortedValues[index];
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function nowMs(): number {
  return performance.now();
}

export function approximateBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function writeBenchmarkResult<TMetrics extends Record<string, unknown>>(
  outputPath: string,
  envelope: BenchmarkEnvelope<TMetrics>,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
}

export function defaultResultPath(kind: string, scenario: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join('benchmark-results', `${stamp}-${kind}-${scenario}.json`);
}

export async function readBenchmarkResults(
  directory = 'benchmark-results',
): Promise<BenchmarkEnvelope<Record<string, unknown>>[]> {
  const entries = await readdir(directory).catch(() => []);
  const jsonEntries = entries.filter((entry) => entry.endsWith('.json')).sort();
  const results: BenchmarkEnvelope<Record<string, unknown>>[] = [];
  for (const entry of jsonEntries) {
    const content = await readFile(join(directory, entry), 'utf8');
    results.push(JSON.parse(content) as BenchmarkEnvelope<Record<string, unknown>>);
  }
  return results;
}
