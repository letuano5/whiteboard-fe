import { describe, it, expect } from 'vitest';
import { rectangleShapeUtil } from '../rectangle';
import { ellipseShapeUtil } from '../ellipse';
import { diamondShapeUtil } from '../diamond';
import { lineShapeUtil } from '../line';
import { textShapeUtil } from '../text';
import type { Element } from '../../../types/shared';

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'test-id',
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 12345,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

type AnyProps = Record<string, unknown>;

describe('rectangleShapeUtil', () => {
  it('renders a <rect> element', () => {
    const el = makeElement({ type: 'rectangle' });
    const jsx = rectangleShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    expect(jsx.type).toBe('rect');
    expect(p['x']).toBe(10);
    expect(p['y']).toBe(20);
    expect(p['width']).toBe(100);
    expect(p['height']).toBe(50);
  });

  it('getBounds returns element bounds', () => {
    const el = makeElement({ x: 5, y: 10, width: 200, height: 80 });
    expect(rectangleShapeUtil.getBounds(el)).toEqual({ x: 5, y: 10, width: 200, height: 80 });
  });

  it('adds rotate transform when angle is non-zero', () => {
    const el = makeElement({ angle: Math.PI / 4 });
    const jsx = rectangleShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    expect(String(p['transform'])).toContain('rotate');
  });

  it('no transform when angle is 0', () => {
    const el = makeElement({ angle: 0 });
    const jsx = rectangleShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    expect(p['transform']).toBeUndefined();
  });
});

describe('ellipseShapeUtil', () => {
  it('renders an <ellipse> element with correct radii', () => {
    const el = makeElement({ type: 'ellipse', x: 0, y: 0, width: 80, height: 40 });
    const jsx = ellipseShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    expect(jsx.type).toBe('ellipse');
    expect(p['rx']).toBe(40);
    expect(p['ry']).toBe(20);
    expect(p['cx']).toBe(40);
    expect(p['cy']).toBe(20);
  });

  it('getBounds returns element bounds', () => {
    const el = makeElement({ type: 'ellipse', x: 5, y: 15, width: 60, height: 30 });
    expect(ellipseShapeUtil.getBounds(el)).toEqual({ x: 5, y: 15, width: 60, height: 30 });
  });
});

describe('diamondShapeUtil', () => {
  it('renders a <polygon> element', () => {
    const el = makeElement({ type: 'diamond', x: 0, y: 0, width: 100, height: 100 });
    const jsx = diamondShapeUtil.render(el);
    expect(jsx.type).toBe('polygon');
  });

  it('diamond points form 4-point shape', () => {
    const el = makeElement({ type: 'diamond', x: 0, y: 0, width: 100, height: 100 });
    const jsx = diamondShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    const points = (p['points'] as string).split(' ').filter(Boolean);
    expect(points.length).toBe(4);
  });

  it('getBounds returns element bounds', () => {
    const el = makeElement({ type: 'diamond', x: 10, y: 20, width: 80, height: 60 });
    expect(diamondShapeUtil.getBounds(el)).toEqual({ x: 10, y: 20, width: 80, height: 60 });
  });
});

describe('lineShapeUtil', () => {
  it('renders a <line> element when no points prop', () => {
    const el = makeElement({ type: 'line' });
    const jsx = lineShapeUtil.render(el);
    expect(jsx.type).toBe('line');
  });

  it('renders a <polyline> when points are provided', () => {
    const el = makeElement({
      type: 'line',
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
        points: [[0, 0], [50, 50], [100, 0]],
      },
    });
    const jsx = lineShapeUtil.render(el);
    expect(jsx.type).toBe('polyline');
  });

  it('getBounds returns element bounds', () => {
    const el = makeElement({ type: 'line', x: 5, y: 5, width: 90, height: 45 });
    expect(lineShapeUtil.getBounds(el)).toEqual({ x: 5, y: 5, width: 90, height: 45 });
  });
});

describe('textShapeUtil', () => {
  it('renders a <text> element', () => {
    const el = makeElement({
      type: 'text',
      props: {
        strokeColor: '#333',
        fillColor: 'none',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
        text: 'Hello',
      },
    });
    const jsx = textShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    expect(jsx.type).toBe('text');
    expect(p['children']).toBe('Hello');
  });

  it('renders empty string when text prop is missing', () => {
    const el = makeElement({ type: 'text' });
    const jsx = textShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    expect(p['children']).toBe('');
  });

  it('getBounds returns element bounds', () => {
    const el = makeElement({ type: 'text', x: 0, y: 0, width: 120, height: 30 });
    expect(textShapeUtil.getBounds(el)).toEqual({ x: 0, y: 0, width: 120, height: 30 });
  });
});

describe('hitTest stubs', () => {
  it('all shapes return false for hitTest', () => {
    const el = makeElement();
    expect(rectangleShapeUtil.hitTest(el, 50, 50)).toBe(false);
    expect(ellipseShapeUtil.hitTest({ ...el, type: 'ellipse' }, 50, 50)).toBe(false);
    expect(diamondShapeUtil.hitTest({ ...el, type: 'diamond' }, 50, 50)).toBe(false);
    expect(lineShapeUtil.hitTest({ ...el, type: 'line' }, 50, 50)).toBe(false);
    expect(textShapeUtil.hitTest({ ...el, type: 'text' }, 50, 50)).toBe(false);
  });
});
