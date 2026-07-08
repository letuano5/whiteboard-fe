import { useEffect, useRef } from 'react';
import type { Element } from '../types/shared';
import { useCameraStore } from '../store/camera.store';
import { useElementsStore } from '../store/elements.store';

type RenderBenchmarkScenario = 'render' | 'pan-zoom' | 'receive-updates';

interface RenderBenchmarkOptions {
  elements: number;
  scenario: RenderBenchmarkScenario;
  durationMs: number;
}

interface RenderBenchmarkResult {
  scenario: RenderBenchmarkScenario;
  elementCount: number;
  timeToFirstRenderMs: number;
  p95FrameTimeMs: number;
  maxFrameTimeMs: number;
  averageFrameTimeMs: number;
  longTaskCount: number;
  svgNodeCount: number;
  domNodeCount: number;
}

interface RenderBenchmarkState {
  startedAt: number;
  options: RenderBenchmarkOptions;
  frameTimes: number[];
  longTaskCount: number;
  ready: boolean;
  result: RenderBenchmarkResult | null;
}

declare global {
  interface Window {
    __VDT_BENCHMARK__?: RenderBenchmarkState;
  }
}

export function initRenderBenchmarkFromQuery(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('benchmark') !== 'render') return;

  const options: RenderBenchmarkOptions = {
    elements: readPositiveInt(params.get('elements'), 1000),
    scenario: readScenario(params.get('scenario')),
    durationMs: readPositiveInt(params.get('durationMs'), 3000),
  };

  window.__VDT_BENCHMARK__ = {
    startedAt: performance.now(),
    options,
    frameTimes: [],
    longTaskCount: 0,
    ready: false,
    result: null,
  };

  useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });
  useElementsStore.getState().setElements(createBenchmarkElements(options.elements));
}

export function RenderBenchmarkProbe() {
  const elements = useElementsStore((state) => state.elements);
  const hasRunRef = useRef(false);

  useEffect(() => {
    const state = window.__VDT_BENCHMARK__;
    if (!state || hasRunRef.current || elements.length < state.options.elements) return;
    hasRunRef.current = true;
    void runRenderBenchmark(state);
  }, [elements.length]);

  return null;
}

async function runRenderBenchmark(state: RenderBenchmarkState): Promise<void> {
  const observer = createLongTaskObserver(state);
  await nextFrame();
  await nextFrame();
  const timeToFirstRenderMs = performance.now() - state.startedAt;
  await runFrameScenario(state);
  observer?.disconnect();

  const frameTimes = state.frameTimes;
  const averageFrameTimeMs =
    frameTimes.reduce((sum, frameTime) => sum + frameTime, 0) / Math.max(1, frameTimes.length);
  state.result = {
    scenario: state.options.scenario,
    elementCount: state.options.elements,
    timeToFirstRenderMs: round(timeToFirstRenderMs),
    p95FrameTimeMs: round(percentile(frameTimes, 0.95)),
    maxFrameTimeMs: round(frameTimes.length > 0 ? Math.max(...frameTimes) : 0),
    averageFrameTimeMs: round(averageFrameTimeMs),
    longTaskCount: state.longTaskCount,
    svgNodeCount: document.querySelectorAll('svg *').length,
    domNodeCount: document.querySelectorAll('*').length,
  };
  state.ready = true;
}

function createLongTaskObserver(state: RenderBenchmarkState): PerformanceObserver | null {
  if (!('PerformanceObserver' in window)) return null;
  if (!PerformanceObserver.supportedEntryTypes.includes('longtask')) return null;
  const observer = new PerformanceObserver((list) => {
    state.longTaskCount += list.getEntries().filter((entry) => entry.duration > 50).length;
  });
  observer.observe({ entryTypes: ['longtask'] });
  return observer;
}

function runFrameScenario(state: RenderBenchmarkState): Promise<void> {
  const started = performance.now();
  let previous = started;
  let updateTick = 0;

  return new Promise((resolve) => {
    const step = (timestamp: number) => {
      state.frameTimes.push(timestamp - previous);
      previous = timestamp;
      const elapsed = timestamp - started;

      if (state.options.scenario === 'pan-zoom') {
        useCameraStore.getState().setCamera({
          x: Math.sin(elapsed / 350) * 600,
          y: Math.cos(elapsed / 420) * 420,
          zoom: 1 + Math.sin(elapsed / 500) * 0.25,
        });
      }

      if (state.options.scenario === 'receive-updates' && elapsed / 100 > updateTick) {
        updateTick += 1;
        mutateVisibleElements(updateTick);
      }

      if (elapsed >= state.options.durationMs) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function mutateVisibleElements(tick: number): void {
  const current = useElementsStore.getState().elements;
  const updated = current.map((element, index) =>
    index % 25 === tick % 25
      ? { ...element, x: element.x + 1, version: element.version + 1, updatedAt: Date.now() }
      : element,
  );
  useElementsStore.getState().setElements(updated);
}

function createBenchmarkElements(count: number): Element[] {
  const colors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];
  return Array.from({ length: count }, (_, index) => {
    const column = index % 100;
    const row = Math.floor(index / 100);
    const type = index % 5 === 0 ? 'text' : index % 3 === 0 ? 'ellipse' : 'rectangle';
    return {
      id: `render-bench-${index}`,
      type,
      x: column * 144,
      y: row * 96,
      width: type === 'text' ? 120 : 96,
      height: type === 'text' ? 32 : 56,
      angle: 0,
      zIndex: index,
      version: 1,
      versionNonce: 10_000 + index,
      updatedAt: Date.now(),
      isDeleted: false,
      groupId: null,
      frameId: null,
      locked: false,
      createdBy: 'benchmark',
      props: {
        strokeColor: colors[index % colors.length],
        fillColor: index % 4 === 0 ? '#f8fafc' : 'transparent',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        text: type === 'text' ? `Bench ${index}` : undefined,
        fontSize: type === 'text' ? 16 : undefined,
        fontFamily: type === 'text' ? 'Inter, sans-serif' : undefined,
        textAlign: type === 'text' ? 'left' : undefined,
      },
    };
  });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1);
  return sorted[index];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function readPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readScenario(value: string | null): RenderBenchmarkScenario {
  return value === 'pan-zoom' || value === 'receive-updates' ? value : 'render';
}
