import { act, fireEvent, render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SvgLayer from '../SvgLayer';
import { useInteractionStore } from '../../../store/interaction.store';
import { rectangleShapeUtil } from '../../shapes/rectangle';
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

  it('prevents native text selection while interacting with the SVG layer', () => {
    const el = makeElement({ id: 'el-1' });

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ userSelect: 'none' });
  });

  it('prevents default browser selection when a resize handle is pressed', () => {
    const el = makeElement({ id: 'el-1' });
    const onHandlePointerDown = vi.fn((_, e: React.PointerEvent<SVGCircleElement>) => {
      expect(e.isDefaultPrevented()).toBe(true);
    });
    useInteractionStore.getState().setSelectedIds([el.id]);

    const { container } = render(
      <SvgLayer elements={[el]} camera={camera} onHandlePointerDown={onHandlePointerDown} />,
    );

    const handle = container.querySelector('circle[data-handle="se"]');
    expect(handle).not.toBeNull();
    fireEvent.pointerDown(handle!);

    expect(onHandlePointerDown).toHaveBeenCalledWith('se', expect.anything());
  });

  // @covers AC-19 (002-move-resize-delete)
  // @covers AC-3
  it('keeps the selection overlay attached to draft bounds during resize', () => {
    const el = makeElement({ id: 'el-1' });
    const draft = { ...el, x: -20, y: -30, width: 30, height: 40 };
    useInteractionStore.getState().setSelectedIds([el.id]);
    useInteractionStore.getState().setDraftElement(draft);

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

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
    useInteractionStore.getState().setDraftElement(draft);

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    const shapeRects = Array.from(container.querySelectorAll('rect')).filter(
      (rect) => rect.getAttribute('stroke') !== '#3b82f6',
    );
    expect(shapeRects).toHaveLength(1);
    expect(shapeRects[0]).toHaveAttribute('x', '80');
    expect(shapeRects[0]).toHaveAttribute('y', '60');
    expect(shapeRects[0].parentElement).toHaveAttribute('opacity', '1');
  });

  it('keeps the local selection overlay attached to a remote draft for the same selected element', () => {
    const el = makeElement({ id: 'shared-el', x: 10, y: 10 });
    const remoteDraft = { ...el, x: 80, y: 60 };
    useInteractionStore.getState().setSelectedIds([el.id]);
    useInteractionStore.setState({
      remoteDrafts: new Map([['peer-a', [remoteDraft]]]),
    });

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    const overlay = container.querySelector('rect[stroke="#3b82f6"]');
    expect(overlay).toHaveAttribute('x', '80');
    expect(overlay).toHaveAttribute('y', '60');
  });

  it('still renders a new draft whose id is not in the committed element list', () => {
    const el = makeElement({ id: 'el-1' });
    const draft = makeElement({ id: '__draft__', x: 200, y: 150 });
    useInteractionStore.getState().setDraftElement(draft);

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    const shapeRects = Array.from(container.querySelectorAll('rect')).filter(
      (rect) => rect.getAttribute('stroke') !== '#3b82f6',
    );
    expect(shapeRects).toHaveLength(2);
    expect(
      shapeRects.find((rect) => rect.getAttribute('x') === '200')?.parentElement,
    ).toHaveAttribute('opacity', '0.6');
  });
});

describe('SvgLayer — P3C-00 render isolation', () => {
  // @covers AC-2
  it('does not re-render unchanged committed shapes when a draft point changes', () => {
    const committed = makeElement({ id: 'committed-rect', type: 'rectangle' });
    const draft = makeElement({
      id: '__draft-line__',
      type: 'line',
      props: {
        ...committed.props,
        points: [
          [0, 0],
          [10, 10],
        ],
      },
    });
    const renderSpy = vi.spyOn(rectangleShapeUtil, 'render');

    render(<SvgLayer elements={[committed]} camera={camera} />);

    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      useInteractionStore.getState().setDraftElement(draft);
    });
    act(() => {
      useInteractionStore.getState().setDraftElement({
        ...draft,
        props: {
          ...draft.props,
          points: [
            [0, 0],
            [10, 10],
            [20, 20],
          ],
        },
      });
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
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
    expect(firstShape).not.toBeNull(); // rectangle (zIndex 1) is first
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

describe('SvgLayer — 018/US1 Remote Selection Highlight', () => {
  function makePeerPresence(sessionId: string, color: string, selectedIds: string[]) {
    return {
      sessionId,
      name: 'Peer',
      color,
      cursor: null as null,
      selectedIds,
      status: 'active' as const,
    };
  }

  // @covers AC-1
  it('T009: renders a solid colored rect border for a single remote selection (AC-1)', () => {
    const el = makeElement({ id: 'el-1' });
    const peers = new Map([['peer-a', makePeerPresence('peer-a', '#ef4444', ['el-1'])]]);
    useInteractionStore.setState({ remoteCursors: peers, remoteDrafts: new Map() });

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    // Expect a rect with stroke matching peer color (no fill, no dashes)
    const remoteHighlights = Array.from(container.querySelectorAll('rect')).filter(
      (r) => r.getAttribute('stroke') === '#ef4444',
    );
    expect(remoteHighlights.length).toBeGreaterThanOrEqual(1);
    expect(remoteHighlights[0].getAttribute('fill')).toBe('none');
    expect(remoteHighlights[0].getAttribute('stroke-dasharray')).toBeFalsy();
  });

  // @covers AC-2
  it("T010: renders colored borders for each of a peer's multiple selected elements (AC-2)", () => {
    const el1 = makeElement({ id: 'el-A', x: 0, y: 0 });
    const el2 = makeElement({ id: 'el-B', x: 200, y: 200 });
    const peers = new Map([['peer-b', makePeerPresence('peer-b', '#10b981', ['el-A', 'el-B'])]]);
    useInteractionStore.setState({ remoteCursors: peers, remoteDrafts: new Map() });

    const { container } = render(<SvgLayer elements={[el1, el2]} camera={camera} />);

    const remoteHighlights = Array.from(container.querySelectorAll('rect')).filter(
      (r) => r.getAttribute('stroke') === '#10b981',
    );
    expect(remoteHighlights.length).toBe(2);
  });

  // @covers AC-3
  it('T011: renders simultaneous selections from two peers in their respective colors (AC-3)', () => {
    const el1 = makeElement({ id: 'el-X', x: 0, y: 0 });
    const el2 = makeElement({ id: 'el-Y', x: 200, y: 200 });
    const peers = new Map([
      ['peer-c', makePeerPresence('peer-c', '#f59e0b', ['el-X'])],
      ['peer-d', makePeerPresence('peer-d', '#6366f1', ['el-Y'])],
    ]);
    useInteractionStore.setState({ remoteCursors: peers, remoteDrafts: new Map() });

    const { container } = render(<SvgLayer elements={[el1, el2]} camera={camera} />);

    const amberHighlights = Array.from(container.querySelectorAll('rect')).filter(
      (r) => r.getAttribute('stroke') === '#f59e0b',
    );
    const indigoHighlights = Array.from(container.querySelectorAll('rect')).filter(
      (r) => r.getAttribute('stroke') === '#6366f1',
    );
    expect(amberHighlights.length).toBeGreaterThanOrEqual(1);
    expect(indigoHighlights.length).toBeGreaterThanOrEqual(1);
  });

  // @covers AC-4
  it('T012: no remote highlight rect when peer selectedIds is empty (AC-4)', () => {
    const el = makeElement({ id: 'el-Z' });
    const peers = new Map([['peer-e', makePeerPresence('peer-e', '#ef4444', [])]]);
    useInteractionStore.setState({ remoteCursors: peers, remoteDrafts: new Map() });

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    const remoteHighlights = Array.from(container.querySelectorAll('rect')).filter(
      (r) => r.getAttribute('stroke') === '#ef4444',
    );
    expect(remoteHighlights.length).toBe(0);
  });

  it('no remote highlight when remoteCursors is empty', () => {
    const el = makeElement({ id: 'el-1' });
    useInteractionStore.setState({ remoteCursors: new Map(), remoteDrafts: new Map() });

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    // Remote highlights are fill="none" rects with a stroke that isn't the local selection blue (#3b82f6).
    // When remoteCursors is empty, no such rect should exist.
    const remoteHighlights = Array.from(container.querySelectorAll('rect')).filter(
      (r) =>
        r.getAttribute('fill') === 'none' &&
        r.getAttribute('stroke') !== null &&
        r.getAttribute('stroke') !== '#3b82f6',
    );
    expect(remoteHighlights.length).toBe(0);
  });

  it('T016 edge: skips highlight for remote selectedId that no longer exists in elements', () => {
    const el = makeElement({ id: 'el-exists' });
    const peers = new Map([['peer-f', makePeerPresence('peer-f', '#ef4444', ['el-deleted'])]]);
    useInteractionStore.setState({ remoteCursors: peers, remoteDrafts: new Map() });

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    const remoteHighlights = Array.from(container.querySelectorAll('rect')).filter(
      (r) => r.getAttribute('stroke') === '#ef4444',
    );
    expect(remoteHighlights.length).toBe(0);
  });

  it('rotates remote selection border with the selected element angle', () => {
    const el = makeElement({ id: 'rotated-el', angle: Math.PI / 2 });
    const peers = new Map([['peer-r', makePeerPresence('peer-r', '#ec4899', [el.id])]]);
    useInteractionStore.setState({ remoteCursors: peers, remoteDrafts: new Map() });

    const { container } = render(<SvgLayer elements={[el]} camera={camera} />);

    const remoteHighlight = container.querySelector('rect[stroke="#ec4899"]');
    expect(remoteHighlight).toHaveAttribute('transform', 'rotate(90 60 35)');
  });
});

describe('SvgLayer — 018/US2 Remote Draft Ghost', () => {
  function makeDraftEl(id: string): Element {
    return {
      id,
      type: 'rectangle',
      x: 50,
      y: 50,
      width: 120,
      height: 60,
      angle: 0,
      zIndex: 2,
      props: {
        strokeColor: '#000',
        fillColor: '#aaa',
        strokeWidth: 1,
        strokeStyle: 'solid',
        opacity: 1,
      },
      version: 2,
      versionNonce: 99,
      updatedAt: Date.now(),
      isDeleted: false,
      groupId: null,
      frameId: null,
      locked: false,
      createdBy: 'peer-g',
    };
  }

  // @covers AC-6
  it('T023: renders remote draft ghost at reduced opacity (AC-6)', () => {
    const draftEl = makeDraftEl('peer-draft-el');
    const remoteDrafts = new Map([['peer-g', [draftEl]]]);
    const peers = new Map([
      [
        'peer-g',
        {
          sessionId: 'peer-g',
          name: 'G',
          color: '#22c55e',
          cursor: null,
          selectedIds: [],
          status: 'active' as const,
        },
      ],
    ]);
    useInteractionStore.setState({ remoteCursors: peers, remoteDrafts });

    const { container } = render(<SvgLayer elements={[]} camera={camera} />);

    // The ghost <g> must have opacity 0.5
    const ghostGroups = Array.from(container.querySelectorAll('g[opacity="0.5"]'));
    expect(ghostGroups.length).toBeGreaterThanOrEqual(1);
  });

  // @covers AC-7, AC-10
  it('T024: when remoteDrafts[sessionId] is removed, ghost elements disappear (AC-7/AC-10)', () => {
    const draftEl = makeDraftEl('peer-draft-el-2');
    const peers = new Map([
      [
        'peer-h',
        {
          sessionId: 'peer-h',
          name: 'H',
          color: '#f97316',
          cursor: null,
          selectedIds: [],
          status: 'active' as const,
        },
      ],
    ]);

    // First render with a draft
    useInteractionStore.setState({
      remoteCursors: peers,
      remoteDrafts: new Map([['peer-h', [draftEl]]]),
    });
    const { container, rerender } = render(<SvgLayer elements={[]} camera={camera} />);
    const ghostGroupsBefore = Array.from(container.querySelectorAll('g[opacity="0.5"]'));
    expect(ghostGroupsBefore.length).toBeGreaterThanOrEqual(1);

    // Remove draft (commit or cancel)
    useInteractionStore.setState({ remoteDrafts: new Map() });
    rerender(<SvgLayer elements={[]} camera={camera} />);

    const ghostGroupsAfter = Array.from(container.querySelectorAll('g[opacity="0.5"]'));
    expect(ghostGroupsAfter.length).toBe(0);
  });

  it('renders no ghost when remoteDrafts is empty', () => {
    useInteractionStore.setState({ remoteDrafts: new Map(), remoteCursors: new Map() });

    const { container } = render(<SvgLayer elements={[]} camera={camera} />);

    const ghostGroups = Array.from(container.querySelectorAll('g[opacity="0.5"]'));
    expect(ghostGroups.length).toBe(0);
  });

  it('rotates the remote draft bbox border with the draft element angle', () => {
    const draftEl = makeDraftEl('peer-rotated-draft');
    const rotatedDraft = { ...draftEl, angle: Math.PI / 4 };
    const remoteDrafts = new Map([['peer-i', [rotatedDraft]]]);
    const peers = new Map([
      [
        'peer-i',
        {
          sessionId: 'peer-i',
          name: 'I',
          color: '#06b6d4',
          cursor: null,
          selectedIds: [],
          status: 'active' as const,
        },
      ],
    ]);
    useInteractionStore.setState({ remoteCursors: peers, remoteDrafts });

    const { container } = render(<SvgLayer elements={[]} camera={camera} />);

    const draftOutline = container.querySelector('rect[stroke="#06b6d4"]');
    expect(draftOutline).toHaveAttribute('transform', 'rotate(45 110 80)');
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
