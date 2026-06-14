import { describe, expect, it } from 'vitest';
import type { Camera } from '../types/shared';
import { MAX_ZOOM, MIN_ZOOM, screenToWorld, worldToScreen } from './camera';

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
