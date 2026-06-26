import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import SvgLayer from '../SvgLayer';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Camera, Element } from '../../../types/shared';

const camera: Camera = { x: 0, y: 0, zoom: 1 };

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'el-1',
    type: 'rectangle',
    x: 10,
    y: 10,
    width: 100,
    height: 50,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#000',
      fillColor: '#fff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 123,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

beforeEach(() => {
  useInteractionStore.getState().reset();
});

describe('SvgLayer — SelectionOverlay', () => {
  // @covers AC-7
  it('renders exactly 9 handle circles when a shape is selected (8 resize + 1 rotate)', () => {
    const el = makeElement({ id: 'el-1' });
    useInteractionStore.getState().setSelectedIds(['el-1']);

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(9);
  });

  it('renders no handles when selectedIds is empty', () => {
    const el = makeElement({ id: 'el-1' });

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(0);
  });

  it('renders no handles when selected element does not exist in elements list', () => {
    useInteractionStore.getState().setSelectedIds(['nonexistent']);

    const { container } = render(<SvgLayer elements={[]} camera={camera} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(0);
  });

  // @covers AC-19 (002-move-resize-delete)
  it('keeps the selection overlay attached to draft bounds during resize', () => {
    const el = makeElement({ id: 'el-1' });
    const draft = { ...el, x: -20, y: -30, width: 30, height: 40 };
    useInteractionStore.getState().setSelectedIds([el.id]);

    const { container } = render(
      <SvgLayer elements={[el]} camera={camera} draftElement={draft} />,
    );

    const overlay = container.querySelector('rect[stroke="#3b82f6"]');
    const activeCorner = container.querySelector('circle[data-handle="nw"]');
    expect(overlay).toHaveAttribute('x', '-20');
    expect(overlay).toHaveAttribute('y', '-30');
    expect(overlay).toHaveAttribute('width', '30');
    expect(overlay).toHaveAttribute('height', '40');
    expect(activeCorner).toHaveAttribute('cx', '-20');
    expect(activeCorner).toHaveAttribute('cy', '-30');
  });

  it('renders only the draft copy while an existing element is moving or resizing', () => {
    const el = makeElement({ id: 'el-1', x: 10, y: 10 });
    const draft = { ...el, x: 80, y: 60 };
    useInteractionStore.getState().setSelectedIds([el.id]);

    const { container } = render(
      <SvgLayer elements={[el]} camera={camera} draftElement={draft} />,
    );

    const shapeRects = Array.from(container.querySelectorAll('rect')).filter(
      (rect) => rect.getAttribute('stroke') !== '#3b82f6',
    );
    expect(shapeRects).toHaveLength(1);
    expect(shapeRects[0]).toHaveAttribute('x', '80');
    expect(shapeRects[0]).toHaveAttribute('y', '60');
    expect(shapeRects[0].parentElement).toHaveAttribute('opacity', '1');
  });

  it('still renders a new draft whose id is not in the committed element list', () => {
    const el = makeElement({ id: 'el-1' });
    const draft = makeElement({ id: '__draft__', x: 200, y: 150 });

    const { container } = render(
      <SvgLayer elements={[el]} camera={camera} draftElement={draft} />,
    );

    const shapeRects = Array.from(container.querySelectorAll('rect')).filter(
      (rect) => rect.getAttribute('stroke') !== '#3b82f6',
    );
    expect(shapeRects).toHaveLength(2);
    expect(shapeRects.find((rect) => rect.getAttribute('x') === '200')?.parentElement).toHaveAttribute(
      'opacity',
      '0.6',
    );
  });
});

describe('SvgLayer — P1A-10 Z-order render order', () => {
  // @covers AC-8 (006-localstorage-zorder)
  it('renders lower-zIndex element before higher-zIndex element in DOM order', () => {
    const elA = makeElement({ id: 'shape-a', type: 'rectangle', zIndex: 1 });
    const elB = makeElement({ id: 'shape-b', type: 'ellipse', zIndex: 2 });

    const { container } = render(<SvgLayer elements={[elA, elB]} camera={camera} />);

    // Both shapes render inside the transform <g>; query all shape-level <g> wrappers
    const shapeGroups = container.querySelectorAll('svg > g > g');
    expect(shapeGroups.length).toBeGreaterThanOrEqual(2);

    // First <g> wraps the lower-zIndex shape (rectangle renders a <rect>)
    const firstShape = shapeGroups[0].querySelector('rect');
    const secondShape = shapeGroups[1].querySelector('ellipse');
    expect(firstShape).not.toBeNull();  // rectangle (zIndex 1) is first
    expect(secondShape).not.toBeNull(); // ellipse (zIndex 2) is second
  });

  // @covers AC-8 (006-localstorage-zorder)
  it('renders correct order even when elements array is given in reverse zIndex order', () => {
    const elHigh = makeElement({ id: 'high', type: 'ellipse', zIndex: 5 });
    const elLow = makeElement({ id: 'low', type: 'rectangle', zIndex: 1 });

    // Pass high-zIndex element first in array
    const { container } = render(<SvgLayer elements={[elHigh, elLow]} camera={camera} />);

    const shapeGroups = container.querySelectorAll('svg > g > g');
    expect(shapeGroups.length).toBeGreaterThanOrEqual(2);

    // Rectangle (zIndex 1) must still be rendered first regardless of array order
    const firstShape = shapeGroups[0].querySelector('rect');
    const secondShape = shapeGroups[1].querySelector('ellipse');
    expect(firstShape).not.toBeNull();
    expect(secondShape).not.toBeNull();
  });
});

describe('SvgLayer — Laser trail rendering (011-laser-pointer)', () => {
  // @covers AC-8 (011-laser-pointer)
  it('renders a polyline with world-coordinate points (camera transform applied by parent <g>)', () => {
    // Camera with zoom=4 and offset — if points were pre-transformed they'd differ
    const cam: Camera = { x: 50, y: 50, zoom: 4 };
    useInteractionStore.getState().setLaserTrail([
      { x: 100, y: 200 },
      { x: 150, y: 250 },
    ]);

    const { container } = render(<SvgLayer elements={[]} camera={cam} />);

    const polyline = container.querySelector('polyline');
    expect(polyline).not.toBeNull();
    expect(polyline?.getAttribute('points')).toBe('100,200 150,250');
  });

  it('does not render a polyline when trail has fewer than 2 points', () => {
    useInteractionStore.getState().setLaserTrail([{ x: 10, y: 20 }]);

    const { container } = render(<SvgLayer elements={[]} camera={camera} />);

    expect(container.querySelector('polyline')).toBeNull();
  });

  it('renders no polyline when trail is empty', () => {
    useInteractionStore.getState().setLaserTrail([]);

    const { container } = render(<SvgLayer elements={[]} camera={camera} />);

    expect(container.querySelector('polyline')).toBeNull();
  });

  it('applies opacity=0 and transition when laserFading=true', () => {
    useInteractionStore.getState().setLaserTrail([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
    useInteractionStore.getState().setLaserFading(true);

    const { container } = render(<SvgLayer elements={[]} camera={camera} />);

    const polyline = container.querySelector('polyline');
    expect(polyline?.getAttribute('opacity')).toBe('0');
  });
});

describe('SvgLayer — P1A-03 Delete rendering', () => {
  // @covers AC-10 (002-move-resize-delete)
  it('does not render a soft-deleted element even when it is selected', () => {
    const del = makeElement({ id: 'del-1', isDeleted: true });
    useInteractionStore.getState().setSelectedIds(['del-1']);

    const { container } = render(<SvgLayer elements={[del]} camera={camera} />);

    // Rectangle shape renders <rect>; SelectionOverlay also renders <rect>
    // Neither should appear for a deleted element
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(0);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(0);
  });
});
