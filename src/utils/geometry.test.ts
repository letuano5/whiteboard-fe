import { describe, it, expect } from 'vitest';
import { rotatePoint, unrotatePoint } from './geometry';

describe('rotatePoint', () => {
  it('@covers AC-3: rotating (1,0) around origin by π/2 returns approx (0,1)', () => {
    const result = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
  });

  it('rotating (1,0) around origin by π returns approx (-1,0)', () => {
    const result = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI);
    expect(result.x).toBeCloseTo(-1);
    expect(result.y).toBeCloseTo(0);
  });

  it('rotating around a non-origin center', () => {
    // Rotate (2,1) around (1,1) by π/2 → should give (1,2)
    const result = rotatePoint({ x: 2, y: 1 }, { x: 1, y: 1 }, Math.PI / 2);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(2);
  });
});

describe('unrotatePoint', () => {
  it('@covers AC-12: unrotatePoint with angle=0 is identity', () => {
    const pt = { x: 5, y: 7 };
    const result = unrotatePoint(pt, { x: 2, y: 3 }, 0);
    expect(result.x).toBeCloseTo(pt.x);
    expect(result.y).toBeCloseTo(pt.y);
  });

  it('unrotatePoint is the inverse of rotatePoint', () => {
    const pt = { x: 3, y: 4 };
    const center = { x: 1, y: 1 };
    const angle = Math.PI / 3;
    const rotated = rotatePoint(pt, center, angle);
    const back = unrotatePoint(rotated, center, angle);
    expect(back.x).toBeCloseTo(pt.x);
    expect(back.y).toBeCloseTo(pt.y);
  });

  it('@covers AC-3: un-rotating a 90° rotated point returns original', () => {
    const pt = { x: 1, y: 0 };
    const center = { x: 0, y: 0 };
    const rotated = rotatePoint(pt, center, Math.PI / 2);
    const back = unrotatePoint(rotated, center, Math.PI / 2);
    expect(back.x).toBeCloseTo(pt.x);
    expect(back.y).toBeCloseTo(pt.y);
  });
});
