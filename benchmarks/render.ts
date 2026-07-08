import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { chromium } from 'playwright';
import { parseArgs, getBoolean, getNumber, getNumberList, getString } from './lib/cli.js';
import { defaultResultPath, sleep, writeBenchmarkResult } from './lib/metrics.js';

interface RenderMetric {
  scenario: string;
  elementCount: number;
  timeToFirstRenderMs: number;
  p95FrameTimeMs: number;
  maxFrameTimeMs: number;
  averageFrameTimeMs: number;
  longTaskCount: number;
  svgNodeCount: number;
  domNodeCount: number;
}

interface BrowserBenchmarkState {
  ready: boolean;
  result: RenderMetric | null;
}

const args = parseArgs();
const target = getString(args, 'target', 'http://127.0.0.1:5173');
const scenarios = getString(args, 'scenarios', getString(args, 'scenario', 'render,pan-zoom'))
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
const elementCounts = getNumberList(args, 'elements', [1000, 5000, 10000]);
const durationMs = getNumber(args, 'duration-ms', 3000);
const outputPath = getString(args, 'output', defaultResultPath('render', 'svg-elements'));
const startServer = getBoolean(
  args,
  'start-server',
  target.includes('127.0.0.1') || target.includes('localhost'),
);
const port = new URL(target).port || '5173';

void main();

async function main(): Promise<void> {
  const startedAt = new Date();
  const server = startServer ? startViteServer(port) : null;
  const notes: string[] = [];

  try {
    if (server) {
      await waitForHttp(target, 30_000);
      notes.push(`Started local Vite server on ${target}.`);
    }

    const browser = await chromium.launch({ headless: true });
    const results: RenderMetric[] = [];
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      for (const scenario of scenarios) {
        for (const elementCount of elementCounts) {
          const url = withBenchmarkParams(target, scenario, elementCount);
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          const result = await waitForBenchmarkResult(page);
          results.push(result);
        }
      }
    } finally {
      await browser.close();
    }

    await writeBenchmarkResult(outputPath, {
      kind: 'render',
      scenario: 'svg-elements',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      target,
      options: { scenarios, elementCounts, durationMs, browser: 'chromium', startServer },
      metrics: { runs: results },
      notes,
    });
    console.log(`Render benchmark wrote ${outputPath}`);
  } finally {
    server?.kill('SIGTERM');
  }
}

function startViteServer(serverPort: string): ChildProcessWithoutNullStreams {
  return spawn(
    'pnpm',
    ['--filter', 'whiteboard-fe', 'dev', '--host', '127.0.0.1', '--port', serverPort],
    { cwd: process.cwd(), env: process.env },
  );
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function withBenchmarkParams(baseUrl: string, scenario: string, elements: number): string {
  const url = new URL(baseUrl);
  url.searchParams.set('benchmark', 'render');
  url.searchParams.set('scenario', scenario);
  url.searchParams.set('elements', String(elements));
  url.searchParams.set('durationMs', String(durationMs));
  return url.toString();
}

async function waitForBenchmarkResult(page: import('playwright').Page): Promise<RenderMetric> {
  await page.waitForFunction(() => window.__VDT_BENCHMARK__?.ready === true, null, {
    timeout: Math.max(20_000, durationMs + 15_000),
  });
  const state = await page.evaluate(() => window.__VDT_BENCHMARK__ as BrowserBenchmarkState);
  if (!state.result) throw new Error('Render benchmark finished without a result.');
  return state.result;
}
