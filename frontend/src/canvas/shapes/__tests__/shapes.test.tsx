import { describe, it, expect } from 'vitest';
import { rectangleShapeUtil } from '../rectangle';
import { ellipseShapeUtil } from '../ellipse';
import { diamondShapeUtil } from '../diamond';
import { lineShapeUtil } from '../line';
import { textShapeUtil } from '../text';
import { imageShapeUtil } from '../image';
import { buildFreehandPath } from '../../freehand-points';
import { freehandShapeUtil, highlighterShapeUtil } from '../ink';
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
    // Line shape wraps in <g> for rotation support; child is the actual <line>
    expect(jsx.type).toBe('g');
    const child = (jsx.props as { children: { type: string } }).children;
    expect(child.type).toBe('line');
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
        points: [
          [0, 0],
          [50, 50],
          [100, 0],
        ],
      },
    });
    const jsx = lineShapeUtil.render(el);
    // Line shape wraps in <g> for rotation support; child is the actual <polyline>
    expect(jsx.type).toBe('g');
    const child = (jsx.props as { children: { type: string } }).children;
    expect(child.type).toBe('polyline');
  });

  it('getBounds returns element bounds', () => {
    const el = makeElement({ type: 'line', x: 5, y: 5, width: 90, height: 45 });
    expect(lineShapeUtil.getBounds(el)).toEqual({ x: 5, y: 5, width: 90, height: 45 });
  });
});

describe('imageShapeUtil', () => {
  // @covers AC-1 (046-image-background)
  // @covers AC-2 (046-image-background)
  it('renders an SVG image node from props.src', () => {
    const el = makeElement({
      type: 'image',
      x: 15,
      y: 25,
      width: 320,
      height: 180,
      props: {
        strokeColor: 'transparent',
        fillColor: 'transparent',
        strokeWidth: 0,
        strokeStyle: 'solid',
        opacity: 0.8,
        src: 'data:image/png;base64,AAAA',
      },
    });

    const jsx = imageShapeUtil.render(el);
    const p = jsx.props as AnyProps;

    expect(jsx.type).toBe('image');
    expect(p['href']).toBe('data:image/png;base64,AAAA');
    expect(p['x']).toBe(15);
    expect(p['y']).toBe(25);
    expect(p['width']).toBe(320);
    expect(p['height']).toBe(180);
    expect(p['opacity']).toBe(0.8);
  });

  // @covers AC-3 (046-image-background)
  it('uses rectangular bounds and hit testing for selection and resizing', () => {
    const el = makeElement({ type: 'image', x: 10, y: 20, width: 100, height: 50 });

    expect(imageShapeUtil.getBounds(el)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    expect(imageShapeUtil.hitTest(el, 60, 45)).toBe(true);
    expect(imageShapeUtil.hitTest(el, 200, 45)).toBe(false);
  });

  it('adds rotate transform when angle is non-zero', () => {
    const el = makeElement({ type: 'image', angle: Math.PI / 2 });
    const jsx = imageShapeUtil.render(el);
    const p = jsx.props as AnyProps;

    expect(p['transform']).toBe('rotate(90 60 45)');
  });
});

describe('ink shape utils', () => {
  // @covers AC-1 (P3C-01)
  // @covers AC-2 (P3C-01)
  it('renders freehand points as an SVG path in world coordinates', () => {
    const el = makeElement({
      type: 'freehand',
      props: {
        strokeColor: '#111827',
        fillColor: 'none',
        strokeWidth: 3,
        strokeStyle: 'solid',
        opacity: 0.9,
        points: [
          [10, 20],
          [30, 45],
          [60, 35],
        ],
      },
    });

    const jsx = freehandShapeUtil.render(el);
    const p = jsx.props as AnyProps;

    expect(jsx.type).toBe('g');
    const child = p['children'] as { type: string; props: AnyProps };
    expect(child.type).toBe('path');
    expect(child.props['d']).toBe('M 10 20 Q 30 45 45 40 L 60 35');
    expect(child.props['fill']).toBe('none');
    expect(child.props['stroke']).toBe('#111827');
    expect(child.props['strokeLinecap']).toBe('round');
    expect(child.props['strokeLinejoin']).toBe('round');
  });

  // @covers AC-1 (P3C-01)
  // @covers AC-2 (P3C-01)
  it('renders highlighter points through the same SVG path pipeline', () => {
    const el = makeElement({
      type: 'highlighter',
      props: {
        strokeColor: '#facc15',
        fillColor: 'none',
        strokeWidth: 12,
        strokeStyle: 'solid',
        opacity: 0.35,
        points: [
          [-5, 5],
          [15, 25],
        ],
      },
    });

    const jsx = highlighterShapeUtil.render(el);
    const p = jsx.props as AnyProps;

    expect(jsx.type).toBe('g');
    const child = p['children'] as { type: string; props: AnyProps };
    expect(child.type).toBe('path');
    expect(child.props['d']).toBe('M -5 5 L 15 25');
    expect(child.props['stroke']).toBe('#facc15');
    expect(child.props['strokeWidth']).toBe(12);
    expect(child.props['opacity']).toBe(0.35);
  });

  it('uses point bounds and segment hit testing for ink elements', () => {
    const el = makeElement({
      type: 'freehand',
      props: {
        strokeColor: '#111827',
        fillColor: 'none',
        strokeWidth: 3,
        strokeStyle: 'solid',
        opacity: 1,
        points: [
          [10, 20],
          [30, 45],
          [60, 35],
        ],
      },
    });

    expect(freehandShapeUtil.getBounds(el)).toEqual({ x: 10, y: 20, width: 50, height: 25 });
    expect(freehandShapeUtil.hitTest(el, 31, 44)).toBe(true);
    expect(freehandShapeUtil.hitTest(el, 300, 300)).toBe(false);
  });

  // @covers AC-2
  it('simplifies raw samples before building a freehand path', () => {
    const rawPoints = [
      [0, 0],
      [1, 0],
      [2, 0],
      [30, 20],
    ] satisfies [number, number][];

    expect(buildFreehandPath(rawPoints)).toBe('M 0 0 L 30 20');
  });

  // @covers AC-4
  it('applies rotation transform when rendering freehand ink', () => {
    const el = makeElement({
      type: 'freehand',
      x: 10,
      y: 20,
      width: 50,
      height: 25,
      angle: Math.PI / 2,
      props: {
        strokeColor: '#111827',
        fillColor: 'none',
        strokeWidth: 3,
        strokeStyle: 'solid',
        opacity: 0.9,
        points: [
          [10, 20],
          [30, 45],
          [60, 35],
        ],
      },
    });

    const jsx = freehandShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    expect(p['transform']).toBe('rotate(90 35 32.5)');
  });
});

describe('textShapeUtil', () => {
  it('renders a <text> element with a tspan child containing the text', () => {
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
    const children = p['children'] as Array<{ type: string; props: AnyProps }>;
    expect(jsx.type).toBe('text');
    expect(Array.isArray(children)).toBe(true);
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe('tspan');
    expect(children[0].props['children']).toBe('Hello');
  });

  it('renders empty string when text prop is missing — single tspan with empty content', () => {
    const el = makeElement({ type: 'text' });
    const jsx = textShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    const children = p['children'] as Array<{ type: string; props: AnyProps }>;
    expect(children).toHaveLength(1);
    expect(children[0].type).toBe('tspan');
    expect(children[0].props['children']).toBe('');
  });

  it('renders multi-line text as multiple tspan elements with dy offsets', () => {
    const el = makeElement({
      type: 'text',
      props: {
        strokeColor: '#333',
        fillColor: 'none',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
        text: 'Hello\nWorld',
        fontSize: 16,
      },
    });
    const jsx = textShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    const children = p['children'] as Array<{ type: string; props: AnyProps }>;
    expect(children).toHaveLength(2);
    expect(children[0].props['children']).toBe('Hello');
    expect(children[0].props['dy']).toBe(0);
    expect(children[1].props['children']).toBe('World');
    expect(children[1].props['dy']).toBeCloseTo(16 * 1.2); // fontSize * lineHeight ratio
  });

  it('renders bound text using the provided element context', () => {
    const container = makeElement({
      id: 'box',
      type: 'rectangle',
      x: 100,
      y: 20,
      width: 100,
      height: 60,
      groupId: 'g',
    });
    const label = makeElement({
      id: 'label',
      type: 'text',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      groupId: 'g',
      props: {
        strokeColor: '#333',
        fillColor: 'none',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
        text: 'Label',
        fontSize: 10,
      },
    });

    const jsx = textShapeUtil.render(label, { elements: [container, label] });
    const props = jsx.props as AnyProps;

    expect(props['x']).toBe(150);
    expect(props['textAnchor']).toBe('middle');
  });

  it('getBounds returns element bounds', () => {
    const el = makeElement({ type: 'text', x: 0, y: 0, width: 120, height: 30 });
    expect(textShapeUtil.getBounds(el)).toEqual({ x: 0, y: 0, width: 120, height: 30 });
  });
});

// makeElement defaults: x=10, y=20, width=100, height=50
// bbox: x∈[10,110], y∈[20,70]
// inside point: (60, 45); outside point: (0, 0); boundary: (10, 20)

describe('rectangleShapeUtil.hitTest', () => {
  it('returns true for point inside bbox', () => {
    expect(rectangleShapeUtil.hitTest(makeElement(), 60, 45)).toBe(true);
  });

  it('returns true for point on bbox boundary', () => {
    expect(rectangleShapeUtil.hitTest(makeElement(), 10, 20)).toBe(true);
    expect(rectangleShapeUtil.hitTest(makeElement(), 110, 70)).toBe(true);
  });

  it('returns false for point outside bbox', () => {
    expect(rectangleShapeUtil.hitTest(makeElement(), 0, 0)).toBe(false);
    expect(rectangleShapeUtil.hitTest(makeElement(), 200, 200)).toBe(false);
  });

  it('returns false for zero-size shape (width=0, height=0) — no throw', () => {
    const el = makeElement({ width: 0, height: 0 });
    expect(() => rectangleShapeUtil.hitTest(el, 10, 20)).not.toThrow();
    expect(rectangleShapeUtil.hitTest(el, 10, 20)).toBe(true); // degenerate point hits itself
    expect(rectangleShapeUtil.hitTest(el, 11, 20)).toBe(false);
  });
});

describe('ellipseShapeUtil.hitTest', () => {
  it('returns true for point inside AABB', () => {
    const el = makeElement({ type: 'ellipse' });
    expect(ellipseShapeUtil.hitTest(el, 60, 45)).toBe(true);
  });

  it('returns false for point outside AABB', () => {
    const el = makeElement({ type: 'ellipse' });
    expect(ellipseShapeUtil.hitTest(el, 0, 0)).toBe(false);
  });
});

// @covers AC-13
describe('textShapeUtil textAlign x-anchor: left', () => {
  it('renders with x = element.x and textAnchor="start" for left align', () => {
    const el = makeElement({
      type: 'text',
      x: 10,
      width: 100,
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
        textAlign: 'left',
      },
    });
    const jsx = textShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    expect(p['x']).toBe(10);
    expect(p['textAnchor']).toBe('start');
  });
});

// @covers AC-14
describe('textShapeUtil textAlign x-anchor: center', () => {
  it('renders with x = element.x + width/2 and textAnchor="middle" for center align', () => {
    const el = makeElement({
      type: 'text',
      x: 10,
      width: 100,
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
        textAlign: 'center',
      },
    });
    const jsx = textShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    expect(p['x']).toBe(60); // 10 + 100/2
    expect(p['textAnchor']).toBe('middle');
  });
});

// @covers AC-15
describe('textShapeUtil textAlign x-anchor: right', () => {
  it('renders with x = element.x + width and textAnchor="end" for right align', () => {
    const el = makeElement({
      type: 'text',
      x: 10,
      width: 100,
      props: {
        strokeColor: '#000',
        fillColor: 'none',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
        textAlign: 'right',
      },
    });
    const jsx = textShapeUtil.render(el);
    const p = jsx.props as AnyProps;
    expect(p['x']).toBe(110); // 10 + 100
    expect(p['textAnchor']).toBe('end');
  });
});

describe('textShapeUtil.hitTest', () => {
  it('returns true for point inside AABB', () => {
    const el = makeElement({ type: 'text' });
    expect(textShapeUtil.hitTest(el, 60, 45)).toBe(true);
  });

  it('returns false for point outside AABB', () => {
    const el = makeElement({ type: 'text' });
    expect(textShapeUtil.hitTest(el, 0, 0)).toBe(false);
  });
});

describe('diamondShapeUtil.hitTest', () => {
  it('returns true for point inside bbox', () => {
    const el = makeElement({ type: 'diamond' });
    expect(diamondShapeUtil.hitTest(el, 60, 45)).toBe(true);
  });

  it('returns false for point outside bbox', () => {
    const el = makeElement({ type: 'diamond' });
    expect(diamondShapeUtil.hitTest(el, 0, 0)).toBe(false);
  });
});

describe('lineShapeUtil.hitTest', () => {
  const lineEl = makeElement({
    type: 'line',
    props: {
      strokeColor: '#000',
      fillColor: 'none',
      strokeWidth: 2,
      strokeStyle: 'solid' as const,
      opacity: 1,
      points: [
        [0, 0],
        [100, 0],
      ] as [number, number][],
    },
  });

  it('returns true for point within 8 units of segment', () => {
    expect(lineShapeUtil.hitTest(lineEl, 50, 5)).toBe(true); // 5 units above midpoint
    expect(lineShapeUtil.hitTest(lineEl, 50, -7)).toBe(true); // 7 units below midpoint
  });

  it('returns false for point more than 8 units from segment', () => {
    expect(lineShapeUtil.hitTest(lineEl, 50, 10)).toBe(false); // 10 units above
    expect(lineShapeUtil.hitTest(lineEl, 50, -9)).toBe(false); // 9 units below
  });

  it('returns true for point on segment endpoint', () => {
    expect(lineShapeUtil.hitTest(lineEl, 0, 0)).toBe(true);
    expect(lineShapeUtil.hitTest(lineEl, 100, 0)).toBe(true);
  });

  it('falls back to AABB when no points prop (no throw)', () => {
    const el = makeElement({ type: 'line' }); // no points prop
    expect(() => lineShapeUtil.hitTest(el, 60, 45)).not.toThrow();
    expect(lineShapeUtil.hitTest(el, 60, 45)).toBe(true); // inside expanded AABB
  });
});
