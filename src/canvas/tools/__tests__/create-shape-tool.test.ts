import { describe, it, expect } from 'vitest';
import {
  isShapeTool,
  buildDraftFromPoints,
  isValidSize,
  SHAPE_TOOLS,
} from '../create-shape-tool';
import type { Point } from '../../../types/geometry';

const pt = (x: number, y: number): Point => ({ x, y });

describe('isShapeTool', () => {
  it('returns true for all shape tools', () => {
    for (const t of SHAPE_TOOLS) {
      expect(isShapeTool(t)).toBe(true);
    }
  });

  it('returns false for non-shape tools', () => {
    expect(isShapeTool('select')).toBe(false);
    expect(isShapeTool('hand')).toBe(false);
    expect(isShapeTool('eraser')).toBe(false);
  });
});

describe('buildDraftFromPoints — rectangle', () => {
  it('drag right-down: correct bounds', () => {
    const result = buildDraftFromPoints('rectangle', pt(10, 20), pt(60, 80));
    expect(result).toMatchObject({ type: 'rectangle', x: 10, y: 20, width: 50, height: 60 });
  });

  it('drag left-up (negative direction): normalizes correctly', () => {
    const result = buildDraftFromPoints('rectangle', pt(60, 80), pt(10, 20));
    expect(result).toMatchObject({ type: 'rectangle', x: 10, y: 20, width: 50, height: 60 });
  });

  it('uses default props', () => {
    const result = buildDraftFromPoints('rectangle', pt(0, 0), pt(100, 100));
    expect(result.props.strokeColor).toBe('#1a1a1a');
    expect(result.props.fillColor).toBe('transparent');
    expect(result.props.strokeWidth).toBe(2);
    expect(result.props.strokeStyle).toBe('solid');
    expect(result.props.opacity).toBe(1);
  });
});

describe('buildDraftFromPoints — ellipse', () => {
  it('normalizes negative drag', () => {
    const result = buildDraftFromPoints('ellipse', pt(100, 100), pt(50, 30));
    expect(result).toMatchObject({ type: 'ellipse', x: 50, y: 30, width: 50, height: 70 });
  });
});

describe('buildDraftFromPoints — line', () => {
  it('stores props.points with absolute world coords', () => {
    const result = buildDraftFromPoints('line', pt(10, 20), pt(90, 60));
    expect(result.props.points).toEqual([[10, 20], [90, 60]]);
  });

  it('bounding box: normalizes for negative direction', () => {
    const result = buildDraftFromPoints('line', pt(90, 60), pt(10, 20));
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
    expect(result.width).toBe(80);
    expect(result.height).toBe(40);
    // points still use absolute coords (not normalized)
    expect(result.props.points).toEqual([[90, 60], [10, 20]]);
  });
});

describe('buildDraftFromPoints — text', () => {
  it('has text-specific default props', () => {
    const result = buildDraftFromPoints('text', pt(0, 0), pt(200, 50));
    expect(result.props.text).toBe('');
    expect(result.props.fontSize).toBe(16);
    expect(result.props.fontFamily).toBe('sans-serif');
    expect(result.props.textAlign).toBe('left');
  });

  it('normalizes bounds like rectangle', () => {
    const result = buildDraftFromPoints('text', pt(200, 50), pt(0, 0));
    expect(result).toMatchObject({ x: 0, y: 0, width: 200, height: 50 });
  });
});

describe('isValidSize', () => {
  it('returns true when rectangle is large enough', () => {
    expect(isValidSize('rectangle', pt(0, 0), pt(10, 10))).toBe(true);
  });

  it('returns false when width is too small', () => {
    expect(isValidSize('rectangle', pt(0, 0), pt(3, 10))).toBe(false);
  });

  it('returns false when height is too small', () => {
    expect(isValidSize('rectangle', pt(0, 0), pt(10, 3))).toBe(false);
  });

  it('returns false when both dimensions are too small', () => {
    expect(isValidSize('ellipse', pt(0, 0), pt(4, 4))).toBe(false);
  });

  it('line: uses distance, not separate w/h', () => {
    // diagonal: sqrt(3^2 + 4^2) = 5 → exactly at threshold
    expect(isValidSize('line', pt(0, 0), pt(3, 4))).toBe(true);
  });

  it('line: too short', () => {
    expect(isValidSize('line', pt(0, 0), pt(2, 2))).toBe(false);
  });

  it('works for negative-direction drag (same as positive)', () => {
    expect(isValidSize('rectangle', pt(100, 100), pt(90, 90))).toBe(true);
    expect(isValidSize('rectangle', pt(100, 100), pt(97, 97))).toBe(false);
  });
});
