import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { applyRemoteElements, isApplyingRemote } from '../apply-remote';
import * as pipeline from '../../store/mutation-pipeline';
import type { Element } from '../../types/shared';

function makeEl(overrides: Partial<Element> = {}): Element {
  return {
    id: 'el-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle: 0,
    zIndex: 1,
    version: 1,
    versionNonce: 500,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    props: {
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    ...overrides,
  };
}

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
  useInteractionStore.setState({
    tool: 'select',
    selectedIds: [],
    draggingId: null,
    dragStart: null,
    draftElement: null,
    marquee: null,
    resizeHandle: null,
    resizeSession: null,
    isRotating: false,
    editingId: null,
    laserTrail: [],
    laserFading: false,
    remoteCursors: new Map(),
  });
});

// @covers AC-1
describe('AC-1: new element is added to store', () => {
  it('adds an element that does not exist in the store', () => {
    const el = makeEl({ id: 'new-el' });
    applyRemoteElements([el]);
    const { elements } = useElementsStore.getState();
    expect(elements.find((e) => e.id === 'new-el')).toBeDefined();
  });
});

// @covers AC-2
// @covers 014/AC-2
describe('AC-2: element position/size update syncs', () => {
  it('applies a higher-version remote element with updated position', () => {
    const local = makeEl({ id: 'el-1', x: 0, y: 0, version: 1, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });

    const remote = makeEl({ id: 'el-1', x: 100, y: 100, version: 2, versionNonce: 500 });
    applyRemoteElements([remote]);

    const { elements } = useElementsStore.getState();
    const updated = elements.find((e) => e.id === 'el-1')!;
    expect(updated.x).toBe(100);
    expect(updated.y).toBe(100);
  });
});

// @covers AC-3
// @covers 014/AC-3
describe('AC-3: soft-delete propagates from remote', () => {
  it('sets isDeleted=true when remote has higher version and isDeleted=true', () => {
    const local = makeEl({ id: 'el-1', isDeleted: false, version: 1, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });

    const remote = makeEl({ id: 'el-1', isDeleted: true, version: 2, versionNonce: 500 });
    applyRemoteElements([remote]);

    const { elements } = useElementsStore.getState();
    expect(elements.find((e) => e.id === 'el-1')!.isDeleted).toBe(true);
  });
});

// @covers AC-4
describe('AC-4: style property change syncs', () => {
  it('applies updated fillColor from remote with higher version', () => {
    const local = makeEl({
      id: 'el-1',
      version: 1,
      versionNonce: 500,
      props: { strokeColor: '#000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', opacity: 1 },
    });
    useElementsStore.setState({ elements: [local] });

    const remote = makeEl({
      id: 'el-1',
      version: 2,
      versionNonce: 500,
      props: { strokeColor: '#000', fillColor: '#ff0000', strokeWidth: 2, strokeStyle: 'solid', opacity: 1 },
    });
    applyRemoteElements([remote]);

    const { elements } = useElementsStore.getState();
    expect(elements.find((e) => e.id === 'el-1')!.props.fillColor).toBe('#ff0000');
  });
});

// @covers AC-5
// @covers 014/AC-6
describe('AC-5: higher version wins LWW', () => {
  it('applies incoming element when version is strictly greater', () => {
    const local = makeEl({ id: 'el-1', x: 0, version: 5, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });

    const remote = makeEl({ id: 'el-1', x: 99, version: 6, versionNonce: 500 });
    applyRemoteElements([remote]);

    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(99);
  });
});

// @covers AC-6
// @covers 014/AC-7
describe('AC-6: lower version is ignored', () => {
  it('ignores incoming element when version is strictly less', () => {
    const local = makeEl({ id: 'el-1', x: 50, version: 5, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });

    const remote = makeEl({ id: 'el-1', x: 99, version: 4, versionNonce: 500 });
    applyRemoteElements([remote]);

    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(50);
  });
});

// @covers AC-7
// @covers 014/AC-8
describe('AC-7: equal version, lower nonce wins', () => {
  it('applies incoming when versions are equal and incoming nonce is lower', () => {
    const local = makeEl({ id: 'el-1', x: 0, version: 5, versionNonce: 50 });
    useElementsStore.setState({ elements: [local] });

    const remote = makeEl({ id: 'el-1', x: 99, version: 5, versionNonce: 10 });
    applyRemoteElements([remote]);

    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(99);
  });
});

// @covers AC-8
// @covers 014/AC-9
describe('AC-8: equal version, higher nonce is ignored', () => {
  it('ignores incoming when versions are equal and incoming nonce is higher', () => {
    const local = makeEl({ id: 'el-1', x: 50, version: 5, versionNonce: 50 });
    useElementsStore.setState({ elements: [local] });

    const remote = makeEl({ id: 'el-1', x: 99, version: 5, versionNonce: 80 });
    applyRemoteElements([remote]);

    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(50);
  });
});

// @covers AC-8 (equal nonce edge case)
// @covers 014/AC-9 (equal nonce: local wins)
describe('AC-8 edge: equal version and equal nonce is NOT applied', () => {
  it('ignores incoming when versions and nonces are identical', () => {
    const local = makeEl({ id: 'el-1', x: 50, version: 5, versionNonce: 50 });
    useElementsStore.setState({ elements: [local] });

    const remote = makeEl({ id: 'el-1', x: 99, version: 5, versionNonce: 50 });
    applyRemoteElements([remote]);

    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(50);
  });
});

// @covers AC-9
// @covers 014/AC-11
describe('AC-9: element being dragged is not overwritten', () => {
  it('skips remote update for element currently being dragged', () => {
    const local = makeEl({ id: 'el-1', x: 0, version: 1, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });
    useInteractionStore.setState({ draggingId: 'el-1' });

    const remote = makeEl({ id: 'el-1', x: 999, version: 2, versionNonce: 500 });
    applyRemoteElements([remote]);

    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(0);
  });
});

// @covers AC-10
// @covers 014/AC-12
describe('AC-10: element being resized/rotated is not overwritten', () => {
  it('skips remote update for element currently being resized', () => {
    const local = makeEl({ id: 'el-1', x: 0, version: 1, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });
    useInteractionStore.setState({
      selectedIds: ['el-1'],
      resizeSession: {
        originalBounds: { x: 0, y: 0, width: 100, height: 50 },
        originalHandle: 'se',
        anchor: { x: 0, y: 0 },
      },
    });

    const remote = makeEl({ id: 'el-1', x: 999, version: 2, versionNonce: 500 });
    applyRemoteElements([remote]);

    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(0);
  });

  it('skips remote update for element currently being rotated', () => {
    const local = makeEl({ id: 'el-1', x: 0, version: 1, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });
    useInteractionStore.setState({ selectedIds: ['el-1'], isRotating: true });

    const remote = makeEl({ id: 'el-1', x: 999, version: 2, versionNonce: 500 });
    applyRemoteElements([remote]);

    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(0);
  });
});

// @covers AC-11
// @covers 014/AC-13
describe('AC-11: element being text-edited is not overwritten', () => {
  it('skips remote update for element currently being text-edited', () => {
    const local = makeEl({ id: 'el-1', x: 0, version: 1, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });
    useInteractionStore.setState({ editingId: 'el-1' });

    const remote = makeEl({ id: 'el-1', x: 999, version: 2, versionNonce: 500 });
    applyRemoteElements([remote]);

    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(0);
  });
});

// @covers AC-12
describe('AC-12: remote changes trigger dispatchMutationEvent (so localStorage hook fires)', () => {
  it('calls dispatchMutationEvent with type=update after applying remote elements', () => {
    const spy = vi.spyOn(pipeline, 'dispatchMutationEvent');
    const el = makeEl({ id: 'new-el', version: 1 });
    applyRemoteElements([el]);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'update', elements: expect.arrayContaining([el]) }),
    );
    spy.mockRestore();
  });

  it('does NOT call dispatchMutationEvent when no elements pass LWW filter', () => {
    const local = makeEl({ id: 'el-1', version: 5, versionNonce: 50 });
    useElementsStore.setState({ elements: [local] });
    const spy = vi.spyOn(pipeline, 'dispatchMutationEvent');

    const remote = makeEl({ id: 'el-1', version: 4, versionNonce: 50 }); // lower version → ignored
    applyRemoteElements([remote]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// @covers AC-14
describe('AC-14: applyRemoteElements accepts (incoming: Element[]) with no BC-specific params', () => {
  it('function signature takes exactly one argument of type Element[]', () => {
    expect(typeof applyRemoteElements).toBe('function');
    expect(applyRemoteElements.length).toBe(1);
  });

  it('isApplyingRemote flag is false when not inside applyRemoteElements', () => {
    expect(isApplyingRemote()).toBe(false);
  });
});

// @covers 014/AC-10 — Convergence: two clients with different update orders end in same state
describe('014/AC-10: deterministic convergence via LWW', () => {
  it('two clients with same version but different nonces converge to the lower-nonce winner', () => {
    // Simulate Client A: has element at x=0 (v=3, nonce=100)
    const elA = makeEl({ id: 'el-shared', x: 0, version: 3, versionNonce: 100 });
    // Client B: has element at x=99 (v=3, nonce=50) — lower nonce → should win
    const elB = makeEl({ id: 'el-shared', x: 99, version: 3, versionNonce: 50 });

    // Client A receives Client B's state
    useElementsStore.setState({ elements: [elA] });
    applyRemoteElements([elB]);
    const xOnClientA = useElementsStore.getState().elements.find((e) => e.id === 'el-shared')!.x;

    // Client B receives Client A's state (reset to B's starting point first)
    useElementsStore.setState({ elements: [elB] });
    applyRemoteElements([elA]);
    const xOnClientB = useElementsStore.getState().elements.find((e) => e.id === 'el-shared')!.x;

    // Both must converge to the same value (lower nonce=50 wins → x=99)
    expect(xOnClientA).toBe(99);
    expect(xOnClientB).toBe(99);
    expect(xOnClientA).toBe(xOnClientB);
  });

  it('two clients with different versions converge to the higher-version winner', () => {
    const elLow = makeEl({ id: 'el-shared', x: 0, version: 2, versionNonce: 500 });
    const elHigh = makeEl({ id: 'el-shared', x: 77, version: 4, versionNonce: 500 });

    useElementsStore.setState({ elements: [elLow] });
    applyRemoteElements([elHigh]);
    const xOnClientA = useElementsStore.getState().elements.find((e) => e.id === 'el-shared')!.x;

    useElementsStore.setState({ elements: [elHigh] });
    applyRemoteElements([elLow]);
    const xOnClientB = useElementsStore.getState().elements.find((e) => e.id === 'el-shared')!.x;

    expect(xOnClientA).toBe(77);
    expect(xOnClientB).toBe(77);
    expect(xOnClientA).toBe(xOnClientB);
  });
});

// @covers 014/AC-14 — Post-drag convergence: LWW applies normally after drag ends
describe('014/AC-14: post-drag convergence', () => {
  it('remote update is skipped while dragging, then applied via LWW after drag ends', () => {
    const local = makeEl({ id: 'el-1', x: 0, version: 3, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });

    // Simulate drag in progress
    useInteractionStore.setState({ draggingId: 'el-1' });

    const remote = makeEl({ id: 'el-1', x: 200, version: 5, versionNonce: 500 });
    applyRemoteElements([remote]);

    // While dragging: remote update must be ignored
    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(0);

    // Simulate drag end: clear draggingId
    useInteractionStore.setState({ draggingId: null });

    // Re-apply the same remote update (server would re-send, or client re-processes after reconnect)
    applyRemoteElements([remote]);

    // After drag ends: LWW applies — remote v=5 > local v=3, so remote wins
    expect(useElementsStore.getState().elements.find((e) => e.id === 'el-1')!.x).toBe(200);
  });
});

// ── 019 feature: Z-order & Arrow Binding sync tests ─────────────────────────

// @covers AC-14
describe('AC-14 (019): remote z-order change updates element zIndex in store', () => {
  it('AC-14: applyRemoteElements with updated zIndex reflects new stacking order', () => {
    const local = makeEl({ id: 'shape-z', zIndex: 1, version: 1, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });

    // Remote has new zIndex = 5 (result of bringToFront on another client)
    const remote = makeEl({ id: 'shape-z', zIndex: 5, version: 2, versionNonce: 500 });
    applyRemoteElements([remote]);

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'shape-z')!;
    expect(updated.zIndex).toBe(5);
  });

  it('AC-14: dispatchMutationEvent is fired after remote zIndex update', () => {
    const spy = vi.spyOn(pipeline, 'dispatchMutationEvent');
    const local = makeEl({ id: 'shape-z2', zIndex: 1, version: 1, versionNonce: 500 });
    useElementsStore.setState({ elements: [local] });

    const remote = makeEl({ id: 'shape-z2', zIndex: 10, version: 2, versionNonce: 500 });
    applyRemoteElements([remote]);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'update' }));
    spy.mockRestore();
  });
});

// @covers AC-15
describe('AC-15 (019): remote arrow binding change updates binding state in store', () => {
  it('AC-15: applyRemoteElements with new endBinding reflects updated binding string', () => {
    const local: Element = {
      id: 'arrow-el',
      type: 'arrow',
      x: 0, y: 0, width: 100, height: 100, angle: 0, zIndex: 2,
      version: 1, versionNonce: 500, updatedAt: 0, isDeleted: false,
      groupId: null, frameId: null, locked: false, createdBy: 'test',
      props: {
        strokeColor: '#000', fillColor: 'transparent', strokeWidth: 2,
        strokeStyle: 'solid', opacity: 1,
        points: [[0, 0], [100, 100]],
      },
    };
    useElementsStore.setState({ elements: [local] });

    const remote: Element = {
      ...local,
      version: 2,
      versionNonce: 500,
      props: {
        ...local.props,
        endBinding: 'target-shape:center',
        points: [[0, 0], [50, 50]],
      },
    };
    applyRemoteElements([remote]);

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'arrow-el')!;
    expect(updated.props.endBinding).toBe('target-shape:center');
    expect(updated.props.points![1][0]).toBe(50);
    expect(updated.props.points![1][1]).toBe(50);
  });

  it('AC-15: applyRemoteElements with endBinding set to null releases the binding', () => {
    const local: Element = {
      id: 'arrow-unbound',
      type: 'arrow',
      x: 0, y: 0, width: 100, height: 100, angle: 0, zIndex: 2,
      version: 1, versionNonce: 500, updatedAt: 0, isDeleted: false,
      groupId: null, frameId: null, locked: false, createdBy: 'test',
      props: {
        strokeColor: '#000', fillColor: 'transparent', strokeWidth: 2,
        strokeStyle: 'solid', opacity: 1,
        points: [[0, 0], [50, 50]],
        endBinding: 'target-shape:center',
      },
    };
    useElementsStore.setState({ elements: [local] });

    const remote: Element = {
      ...local,
      version: 2,
      versionNonce: 500,
      props: { ...local.props, endBinding: undefined },
    };
    applyRemoteElements([remote]);

    const updated = useElementsStore.getState().elements.find((e) => e.id === 'arrow-unbound')!;
    expect(updated.props.endBinding ?? null).toBeNull();
  });
});

// @covers AC-16
describe('AC-16 (019): remote shape move fires mutation hooks so bound arrow endpoints update', () => {
  it('AC-16: applyRemoteElements fires dispatchMutationEvent which triggers arrow-binding-hook', async () => {
    const { registerMutationHook } = await import('../../store/mutation-pipeline');
    const { createArrowBindingHook } = await import('../arrow-binding-hook');

    const shape: Element = makeEl({
      id: 'bound-shape',
      type: 'rectangle',
      x: 100, y: 100, width: 100, height: 60, zIndex: 1,
      version: 1, versionNonce: 100,
    });
    const arrow: Element = {
      id: 'bound-arrow',
      type: 'arrow',
      x: 0, y: 0, width: 200, height: 200, angle: 0, zIndex: 2,
      version: 1, versionNonce: 100, updatedAt: 0, isDeleted: false,
      groupId: null, frameId: null, locked: false, createdBy: 'test',
      props: {
        strokeColor: '#000', fillColor: 'transparent', strokeWidth: 2,
        strokeStyle: 'solid', opacity: 1,
        points: [[0, 0], [150, 130]], // current centre of shape (100+50, 100+30)
        endBinding: 'bound-shape:center',
      },
    };
    useElementsStore.setState({ elements: [shape, arrow] });

    const unregister = registerMutationHook(createArrowBindingHook());

    // Remote client moved shape to x=200, y=200 → new centre=(250,230)
    const movedShape: Element = {
      ...shape,
      x: 200, y: 200,
      version: 2, versionNonce: 50,
    };
    applyRemoteElements([movedShape]);

    // Arrow should have followed via the hook
    const updatedArrow = useElementsStore.getState().elements.find((e) => e.id === 'bound-arrow')!;
    const pts = updatedArrow.props.points!;
    expect(pts[1][0]).toBeCloseTo(250);
    expect(pts[1][1]).toBeCloseTo(230);

    unregister();
  });
});
