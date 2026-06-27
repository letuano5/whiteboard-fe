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
