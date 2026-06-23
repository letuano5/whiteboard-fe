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
  useInteractionStore.getState().setSelectedIds([]);
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
