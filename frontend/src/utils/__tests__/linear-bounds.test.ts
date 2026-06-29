import { describe, it, expect } from 'vitest';
import { normalizeLinearBounds } from '../geometry';

// @covers AC-1, AC-2, AC-3, AC-4

describe('normalizeLinearBounds', () => {
  // @covers AC-3 (empty array guard)
  it('empty array returns {0,0,0,0}', () => {
    expect(normalizeLinearBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  // @covers AC-4 (single-point normalisation)
  it('single point returns zero-size box at that point', () => {
    expect(normalizeLinearBounds([[7, 13]])).toEqual({ x: 7, y: 13, width: 0, height: 0 });
  });

  // @covers AC-1 (two-point diagonal line → correct bbox)
  it('two-point diagonal line returns correct bbox', () => {
    const result = normalizeLinearBounds([
      [10, 20],
      [40, 60],
    ]);
    expect(result).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  // @covers AC-2 (horizontal line → height=0)
  it('horizontal line returns height=0', () => {
    const result = normalizeLinearBounds([
      [5, 15],
      [55, 15],
    ]);
    expect(result).toEqual({ x: 5, y: 15, width: 50, height: 0 });
  });

  // @covers AC-2 (vertical line → width=0)
  it('vertical line returns width=0', () => {
    const result = normalizeLinearBounds([
      [20, 10],
      [20, 80],
    ]);
    expect(result).toEqual({ x: 20, y: 10, width: 0, height: 70 });
  });

  // Purity: input array must not be mutated
  it('does not mutate the input array', () => {
    const pts: [number, number][] = [
      [100, 200],
      [300, 400],
    ];
    const copy = pts.map((p) => [...p]);
    normalizeLinearBounds(pts);
    expect(pts[0]).toEqual(copy[0]);
    expect(pts[1]).toEqual(copy[1]);
  });

  // Non-linear context: function has no type knowledge; a "rectangle-shaped" point cloud
  // (four corners) should still produce a correct bbox.
  it('handles more than two points (e.g. rectangle corners)', () => {
    const result = normalizeLinearBounds([
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ]);
    expect(result).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  // Negative coordinates
  it('handles negative coordinates', () => {
    const result = normalizeLinearBounds([
      [-30, -10],
      [20, 40],
    ]);
    expect(result).toEqual({ x: -30, y: -10, width: 50, height: 50 });
  });

  // Reversed point order (end before start) should produce same bbox
  it('is order-independent (reversed point order same result)', () => {
    const a = normalizeLinearBounds([
      [10, 20],
      [40, 60],
    ]);
    const b = normalizeLinearBounds([
      [40, 60],
      [10, 20],
    ]);
    expect(a).toEqual(b);
  });
});
