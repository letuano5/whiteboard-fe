import { describe, expect, it } from 'vitest';
import type { Camera, Element } from '../types/shared';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_SENSITIVITY,
  FIT_PADDING,
  screenToWorld,
  worldToScreen,
  getContentBounds,
  isAnyElementVisible,
  fitToContent,
} from './camera';

const cam = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });

describe('screenToWorld', () => {
  it('identity at zoom=1, no pan', () => {
    const result = screenToWorld(100, 200, cam(0, 0, 1));
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('zoom=2 halves screen coords relative to world origin', () => {
    const result = screenToWorld(100, 200, cam(0, 0, 2));
    expect(result).toEqual({ x: 50, y: 100 });
  });

  it('zoom=0.5 doubles screen coords relative to world origin', () => {
    const result = screenToWorld(100, 200, cam(0, 0, 0.5));
    expect(result).toEqual({ x: 200, y: 400 });
  });

  it('pan offset shifts world coords', () => {
    const result = screenToWorld(0, 0, cam(50, 30, 1));
    expect(result).toEqual({ x: 50, y: 30 });
  });

  it('pan + zoom combined', () => {
    // screenX / zoom + camera.x = 100/2 + 10 = 60
    const result = screenToWorld(100, 200, cam(10, 20, 2));
    expect(result).toEqual({ x: 60, y: 120 });
  });

  it('negative screen coords', () => {
    const result = screenToWorld(-50, -100, cam(0, 0, 1));
    expect(result).toEqual({ x: -50, y: -100 });
  });

  it('MIN_ZOOM edge case', () => {
    const result = screenToWorld(10, 10, cam(0, 0, MIN_ZOOM));
    expect(result.x).toBeCloseTo(10 / MIN_ZOOM);
    expect(result.y).toBeCloseTo(10 / MIN_ZOOM);
  });

  it('MAX_ZOOM edge case', () => {
    const result = screenToWorld(10, 10, cam(0, 0, MAX_ZOOM));
    expect(result.x).toBeCloseTo(10 / MAX_ZOOM);
    expect(result.y).toBeCloseTo(10 / MAX_ZOOM);
  });
});

describe('worldToScreen', () => {
  it('identity at zoom=1, no pan', () => {
    const result = worldToScreen(100, 200, cam(0, 0, 1));
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('zoom=2 doubles world coords on screen', () => {
    const result = worldToScreen(50, 100, cam(0, 0, 2));
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('zoom=0.5 halves world coords on screen', () => {
    const result = worldToScreen(200, 400, cam(0, 0, 0.5));
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('pan offset shifts screen coords', () => {
    // (worldX - camera.x) * zoom = (50 - 50) * 1 = 0
    const result = worldToScreen(50, 30, cam(50, 30, 1));
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('pan + zoom combined', () => {
    // (60 - 10) * 2 = 100
    const result = worldToScreen(60, 120, cam(10, 20, 2));
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('negative world coords', () => {
    const result = worldToScreen(-50, -100, cam(0, 0, 1));
    expect(result).toEqual({ x: -50, y: -100 });
  });

  it('MIN_ZOOM edge case', () => {
    const result = worldToScreen(10, 10, cam(0, 0, MIN_ZOOM));
    expect(result.x).toBeCloseTo(10 * MIN_ZOOM);
    expect(result.y).toBeCloseTo(10 * MIN_ZOOM);
  });

  it('MAX_ZOOM edge case', () => {
    const result = worldToScreen(10, 10, cam(0, 0, MAX_ZOOM));
    expect(result.x).toBeCloseTo(10 * MAX_ZOOM);
    expect(result.y).toBeCloseTo(10 * MAX_ZOOM);
  });
});

describe('round-trip', () => {
  const cameras: Camera[] = [
    cam(0, 0, 1),
    cam(100, -50, 2),
    cam(-200, 300, 0.5),
    cam(0, 0, MIN_ZOOM),
    cam(0, 0, MAX_ZOOM),
  ];

  for (const camera of cameras) {
    it(`screenToWorld → worldToScreen is identity (zoom=${camera.zoom}, pan=${camera.x},${camera.y})`, () => {
      const screen = { x: 123, y: 456 };
      const world = screenToWorld(screen.x, screen.y, camera);
      const back = worldToScreen(world.x, world.y, camera);
      expect(back.x).toBeCloseTo(screen.x, 10);
      expect(back.y).toBeCloseTo(screen.y, 10);
    });

    it(`worldToScreen → screenToWorld is identity (zoom=${camera.zoom}, pan=${camera.x},${camera.y})`, () => {
      const world = { x: 789, y: -321 };
      const screen = worldToScreen(world.x, world.y, camera);
      const back = screenToWorld(screen.x, screen.y, camera);
      expect(back.x).toBeCloseTo(world.x, 10);
      expect(back.y).toBeCloseTo(world.y, 10);
    });
  }
});

// ─── P1A-11 helpers ──────────────────────────────────────────────────────────

function makeEl(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  deleted = false,
): Element {
  return {
    id,
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    zIndex: 1,
    isDeleted: deleted,
    props: {
      strokeColor: '#000',
      fillColor: '#fff',
      strokeWidth: 1,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 0,
    updatedAt: 0,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
  };
}

// T005 — getContentBounds (@covers AC-3, AC-5)
describe('getContentBounds', () => {
  it('@covers AC-3: returns null for empty array', () => {
    expect(getContentBounds([])).toBeNull();
  });

  it('@covers AC-3 AC-5: returns null when all elements are soft-deleted', () => {
    expect(getContentBounds([makeEl('a', 0, 0, 100, 100, true)])).toBeNull();
  });

  it('@covers AC-5: excludes deleted elements from bbox', () => {
    const els = [makeEl('a', 0, 0, 100, 100), makeEl('b', 500, 500, 50, 50, true)];
    const bounds = getContentBounds(els);
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
  });

  it('returns correct union bbox for multiple active elements', () => {
    const els = [makeEl('a', 10, 20, 100, 80), makeEl('b', 200, 5, 50, 300)];
    const bounds = getContentBounds(els);
    expect(bounds).toEqual({ minX: 10, minY: 5, maxX: 250, maxY: 305 });
  });

  it('single element → bbox equals its own rect', () => {
    const bounds = getContentBounds([makeEl('a', 50, 60, 200, 150)]);
    expect(bounds).toEqual({ minX: 50, minY: 60, maxX: 250, maxY: 210 });
  });
});

// T006 — isAnyElementVisible (@covers AC-1, AC-2, AC-5)
describe('isAnyElementVisible', () => {
  it('@covers AC-2: returns true when element is fully inside viewport', () => {
    // camera (0,0,1), viewport 800x600: element at (100,100) with size 50×50 is visible
    expect(isAnyElementVisible([makeEl('a', 100, 100, 50, 50)], cam(0, 0, 1), 800, 600)).toBe(true);
  });

  it('@covers AC-2: returns true when element partially intersects viewport', () => {
    // element spans x: 700–900, y: 0–100; viewport world-right=800 → partial intersection
    expect(isAnyElementVisible([makeEl('a', 700, 0, 200, 100)], cam(0, 0, 1), 800, 600)).toBe(true);
  });

  it('@covers AC-1: returns false when element is entirely off right edge', () => {
    expect(isAnyElementVisible([makeEl('a', 900, 0, 100, 100)], cam(0, 0, 1), 800, 600)).toBe(false);
  });

  it('@covers AC-1: returns false when element is entirely off bottom edge', () => {
    expect(isAnyElementVisible([makeEl('a', 0, 700, 100, 100)], cam(0, 0, 1), 800, 600)).toBe(false);
  });

  it('@covers AC-1: returns false when all elements are off-screen (far right)', () => {
    const els = [makeEl('a', 10000, 10000, 100, 100)];
    expect(isAnyElementVisible(els, cam(0, 0, 1), 800, 600)).toBe(false);
  });

  it('@covers AC-5: ignores soft-deleted elements (deleted element in viewport → false)', () => {
    expect(isAnyElementVisible([makeEl('a', 100, 100, 50, 50, true)], cam(0, 0, 1), 800, 600)).toBe(false);
  });

  it('returns false when viewportW or viewportH is 0 (guard)', () => {
    expect(isAnyElementVisible([makeEl('a', 0, 0, 100, 100)], cam(0, 0, 1), 0, 600)).toBe(false);
    expect(isAnyElementVisible([makeEl('a', 0, 0, 100, 100)], cam(0, 0, 1), 800, 0)).toBe(false);
  });
});

// T007 — fitToContent (@covers AC-4, AC-5)
describe('fitToContent', () => {
  it('@covers AC-4: camera centers on content bbox with correct zoom', () => {
    // Element at (10000,10000) size 200×100; viewport 800×600
    // rawZoom = min(800*0.85/200, 600*0.85/100) = min(3.4, 5.1) = 3.4
    // centerX=10100, centerY=10050
    // camX = 10100 - 800/(2*3.4); camY = 10050 - 600/(2*3.4)
    const els = [makeEl('a', 10000, 10000, 200, 100)];
    const result = fitToContent(els, cam(0, 0, 1), 800, 600);
    expect(result.zoom).toBeCloseTo(3.4, 5);
    expect(result.x).toBeCloseTo(10100 - 400 / 3.4, 3);
    expect(result.y).toBeCloseTo(10050 - 300 / 3.4, 3);
  });

  it('@covers AC-5: excludes deleted elements from fit calculation', () => {
    // Active element at (0,0,100,100); deleted at (10000,10000,100,100)
    const els = [makeEl('a', 0, 0, 100, 100), makeEl('b', 10000, 10000, 100, 100, true)];
    const result = fitToContent(els, cam(0, 0, 1), 800, 600);
    // Should fit only element a (0,0,100,100)
    // rawZoom = min(800*0.85/100, 600*0.85/100) = min(6.8, 5.1) = 5.1 → clamped to MAX_ZOOM=8? No, 5.1 < 8
    // zoom = 5.1; centerX=50, centerY=50
    expect(result.zoom).toBeCloseTo(5.1, 5);
    expect(result.x).toBeCloseTo(50 - 400 / 5.1, 3);
    expect(result.y).toBeCloseTo(50 - 300 / 5.1, 3);
  });

  it('returns current camera unchanged when no non-deleted elements exist', () => {
    const current = cam(5, 10, 2);
    const result = fitToContent([], current, 800, 600);
    expect(result).toEqual(current);
  });

  it('zoom is clamped to MAX_ZOOM for very small content', () => {
    // 1×1 element in large viewport → would overshoot without clamp
    const els = [makeEl('a', 0, 0, 1, 1)];
    const result = fitToContent(els, cam(0, 0, 1), 800, 600);
    expect(result.zoom).toBeLessThanOrEqual(MAX_ZOOM);
  });

  it('zoom is clamped to MIN_ZOOM for very large content', () => {
    // Huge element: zoom would be < MIN_ZOOM
    const els = [makeEl('a', 0, 0, 1_000_000, 1_000_000)];
    const result = fitToContent(els, cam(0, 0, 1), 800, 600);
    expect(result.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
  });
});

// T007 supplemental — exported constants
describe('ZOOM_SENSITIVITY and FIT_PADDING', () => {
  it('@covers AC-8: ZOOM_SENSITIVITY is ≤ 0.01', () => {
    expect(ZOOM_SENSITIVITY).toBeLessThanOrEqual(0.01);
  });

  it('FIT_PADDING is between 0 and 1', () => {
    expect(FIT_PADDING).toBeGreaterThan(0);
    expect(FIT_PADDING).toBeLessThanOrEqual(1);
  });
});
