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
  it('renders exactly 8 handle circles when a shape is selected', () => {
    const el = makeElement({ id: 'el-1' });
    useInteractionStore.getState().setSelectedIds(['el-1']);

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(8);
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
