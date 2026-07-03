import { describe, it, expect, afterEach } from 'vitest';
import { getShapeUtil, registerShapeUtil } from '../index';
import { rectangleShapeUtil } from '../rectangle';

describe('shape registry', () => {
  afterEach(() => {
    // Restore original rectangle util after overwrite test
    registerShapeUtil(rectangleShapeUtil);
  });

  it('returns the correct util for registered types', () => {
    expect(getShapeUtil('rectangle')).toBeDefined();
    expect(getShapeUtil('rectangle')?.type).toBe('rectangle');

    expect(getShapeUtil('ellipse')).toBeDefined();
    expect(getShapeUtil('ellipse')?.type).toBe('ellipse');

    expect(getShapeUtil('diamond')).toBeDefined();
    expect(getShapeUtil('diamond')?.type).toBe('diamond');

    expect(getShapeUtil('triangle')).toBeDefined();
    expect(getShapeUtil('triangle')?.type).toBe('triangle');

    expect(getShapeUtil('polygon')).toBeDefined();
    expect(getShapeUtil('polygon')?.type).toBe('polygon');

    expect(getShapeUtil('line')).toBeDefined();
    expect(getShapeUtil('line')?.type).toBe('line');

    expect(getShapeUtil('arrow')).toBeDefined();
    expect(getShapeUtil('arrow')?.type).toBe('arrow');

    expect(getShapeUtil('text')).toBeDefined();
    expect(getShapeUtil('text')?.type).toBe('text');

    expect(getShapeUtil('freehand')).toBeDefined();
    expect(getShapeUtil('freehand')?.type).toBe('freehand');

    expect(getShapeUtil('highlighter')).toBeDefined();
    expect(getShapeUtil('highlighter')?.type).toBe('highlighter');
  });

  it('returns undefined for unregistered types', () => {
    expect(getShapeUtil('image')).toBeUndefined();
  });

  it('overwrites an existing util when re-registered', () => {
    const sentinel = { ...rectangleShapeUtil, type: 'rectangle' as const };
    registerShapeUtil(sentinel);
    expect(getShapeUtil('rectangle')).toBe(sentinel);
  });
});
