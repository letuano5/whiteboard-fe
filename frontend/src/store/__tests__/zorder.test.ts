import { describe, it, expect, beforeEach, vi } from 'vitest';
import type * as PipelineModule from '../mutation-pipeline';
import { useElementsStore } from '../elements.store';
import { bringToFront, sendToBack, bringForward, sendBackward } from '../zorder';

// Spy on updateElements from the pipeline so we can assert call count and args.
// We use vi.mock with a factory that wraps the real implementation with a spy.
const updateElementsSpy = vi.fn();

vi.mock('../mutation-pipeline', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof PipelineModule;
  return {
    ...actual,
    updateElements: (...args: Parameters<(typeof PipelineModule)['updateElements']>) => {
      updateElementsSpy(...args);
      return actual.updateElements(...args);
    },
  };
});

type SeedEl = {
  id: string;
  zIndex: number;
  type?: 'rectangle' | 'text';
  groupId?: string | null;
};

function seedStore(els: SeedEl[]) {
  const base = {
    type: 'rectangle' as const,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle: 0,
    props: {
      strokeColor: '#000',
      fillColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid' as const,
      opacity: 1,
    },
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    version: 1,
    versionNonce: 1,
    updatedAt: 0,
    isDeleted: false,
  };
  useElementsStore.setState({
    elements: els.map((e) => ({ ...base, ...e })),
  });
}

function getZIndex(id: string): number {
  const el = useElementsStore.getState().elements.find((e) => e.id === id);
  if (!el) throw new Error(`Element ${id} not found`);
  return el.zIndex;
}

beforeEach(() => {
  useElementsStore.setState({ elements: [] });
  updateElementsSpy.mockClear();
});

// @covers AC-1
describe('bringToFront — AC-1', () => {
  it('AC-1: sets target zIndex above all others; spy called with only target', () => {
    seedStore([
      { id: 'A', zIndex: 0 },
      { id: 'B', zIndex: 1 },
    ]);

    bringToFront('A');

    const aZ = getZIndex('A');
    const bZ = getZIndex('B');
    expect(aZ).toBeGreaterThan(bZ);

    // updateElements called once with only A
    expect(updateElementsSpy).toHaveBeenCalledOnce();
    const arg = updateElementsSpy.mock.calls[0][0] as { id: string }[];
    expect(arg).toHaveLength(1);
    expect(arg[0].id).toBe('A');
  });

  it('AC-1: version increments for updated element', () => {
    seedStore([
      { id: 'A', zIndex: 0 },
      { id: 'B', zIndex: 1 },
    ]);
    bringToFront('A');
    const aEl = useElementsStore.getState().elements.find((e) => e.id === 'A')!;
    expect(aEl.version).toBe(2); // started at 1, incremented by updateElements
  });
});

// @covers AC-2
describe('sendToBack — AC-2', () => {
  it('AC-2: given C at top, sendToBack sets C below all others; only C updated', () => {
    seedStore([
      { id: 'A', zIndex: 0 },
      { id: 'B', zIndex: 1 },
      { id: 'C', zIndex: 2 },
    ]);

    sendToBack('C');

    const cZ = getZIndex('C');
    const aZ = getZIndex('A');
    const bZ = getZIndex('B');
    expect(cZ).toBeLessThan(aZ);
    expect(cZ).toBeLessThan(bZ);

    expect(updateElementsSpy).toHaveBeenCalledOnce();
    const arg = updateElementsSpy.mock.calls[0][0] as { id: string }[];
    expect(arg).toHaveLength(1);
    expect(arg[0].id).toBe('C');
  });
});

// @covers AC-3
describe('bringForward — AC-3', () => {
  it('AC-3: A(0) < B(1) < C(2), bringForward(A) swaps A and B; exactly two elements updated', () => {
    seedStore([
      { id: 'A', zIndex: 0 },
      { id: 'B', zIndex: 1 },
      { id: 'C', zIndex: 2 },
    ]);

    bringForward('A');

    const aZ = getZIndex('A');
    const bZ = getZIndex('B');
    const cZ = getZIndex('C');

    // A must now be above B
    expect(aZ).toBeGreaterThan(bZ);
    // C should remain unchanged at 2
    expect(cZ).toBe(2);

    expect(updateElementsSpy).toHaveBeenCalledOnce();
    const arg = updateElementsSpy.mock.calls[0][0] as { id: string }[];
    expect(arg).toHaveLength(2);
    const ids = arg.map((p) => p.id);
    expect(ids).toContain('A');
    expect(ids).toContain('B');
  });
});

// @covers AC-4
describe('sendBackward — AC-4', () => {
  it('AC-4: A(0) < B(1) < C(2), sendBackward(C) swaps C and B; exactly two elements updated', () => {
    seedStore([
      { id: 'A', zIndex: 0 },
      { id: 'B', zIndex: 1 },
      { id: 'C', zIndex: 2 },
    ]);

    sendBackward('C');

    const aZ = getZIndex('A');
    const bZ = getZIndex('B');
    const cZ = getZIndex('C');

    // C must now be below B
    expect(cZ).toBeLessThan(bZ);
    // A should remain unchanged at 0
    expect(aZ).toBe(0);

    expect(updateElementsSpy).toHaveBeenCalledOnce();
    const arg = updateElementsSpy.mock.calls[0][0] as { id: string }[];
    expect(arg).toHaveLength(2);
    const ids = arg.map((p) => p.id);
    expect(ids).toContain('C');
    expect(ids).toContain('B');
  });
});

// @covers AC-5
describe('boundary no-ops for top element — AC-5', () => {
  it('AC-5: bringToFront on topmost element does not call updateElements', () => {
    seedStore([
      { id: 'A', zIndex: 0 },
      { id: 'B', zIndex: 1 },
    ]);

    bringToFront('B'); // B is already at top
    expect(updateElementsSpy).not.toHaveBeenCalled();
  });

  it('AC-5: bringForward on topmost element does not call updateElements', () => {
    seedStore([
      { id: 'A', zIndex: 0 },
      { id: 'B', zIndex: 1 },
    ]);

    bringForward('B'); // B is already at top
    expect(updateElementsSpy).not.toHaveBeenCalled();
  });
});

// @covers AC-6
describe('boundary no-ops for bottom element — AC-6', () => {
  it('AC-6: sendToBack on bottommost element does not call updateElements', () => {
    seedStore([
      { id: 'A', zIndex: 0 },
      { id: 'B', zIndex: 1 },
    ]);

    sendToBack('A'); // A is already at bottom
    expect(updateElementsSpy).not.toHaveBeenCalled();
  });

  it('AC-6: sendBackward on bottommost element does not call updateElements', () => {
    seedStore([
      { id: 'A', zIndex: 0 },
      { id: 'B', zIndex: 1 },
    ]);

    sendBackward('A'); // A is already at bottom
    expect(updateElementsSpy).not.toHaveBeenCalled();
  });
});

// @covers AC-17
describe('undo/redo for z-order — AC-17', () => {
  it('AC-17: bringToFront then undo restores original zIndex', async () => {
    const { initHistoryCapture } = await import('../../sync/history-capture');
    const { useHistoryStore } = await import('../history.store');
    const { createElement } = await import('../mutation-pipeline');

    useElementsStore.setState({ elements: [] });
    useHistoryStore.setState({ undoStack: [], redoStack: [], isApplying: false });

    const unregister = initHistoryCapture();

    const base = {
      type: 'rectangle' as const,
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      angle: 0,
      props: {
        strokeColor: '#000',
        fillColor: 'transparent',
        strokeWidth: 2,
        strokeStyle: 'solid' as const,
        opacity: 1,
      },
      groupId: null,
      frameId: null,
      locked: false,
      createdBy: 'test',
    };
    const elA = createElement({ ...base });
    const elB = createElement({ ...base });

    const aZBefore = elA.zIndex;
    const bZBefore = elB.zIndex;
    expect(aZBefore).toBeLessThan(bZBefore);

    bringToFront(elA.id);

    const aZAfterBring = useElementsStore.getState().elements.find((e) => e.id === elA.id)!.zIndex;
    expect(aZAfterBring).toBeGreaterThan(bZBefore);

    useHistoryStore.getState().undo();

    const aZAfterUndo = useElementsStore.getState().elements.find((e) => e.id === elA.id)!.zIndex;
    expect(aZAfterUndo).toBe(aZBefore);

    unregister();
  });
});

// @covers AC-7
describe('bound text z-order cascade — AC-7', () => {
  beforeEach(() => {
    seedStore([
      { id: 'container', type: 'rectangle', groupId: 'g', zIndex: 1 },
      { id: 'label', type: 'text', groupId: 'g', zIndex: 2 },
      { id: 'other', zIndex: 3 },
    ]);
  });

  it('AC-7: bringToFront on a bound container carries the label above it in one batch', () => {
    bringToFront('container');

    expect(getZIndex('label')).toBe(getZIndex('container') + 1);
    expect(updateElementsSpy).toHaveBeenCalledOnce();
    const ids = (updateElementsSpy.mock.calls[0][0] as { id: string }[]).map((patch) => patch.id);
    expect(ids).toEqual(['container', 'label']);
  });

  it('AC-7: z-order directly on bound text is a no-op', () => {
    sendToBack('label');
    expect(updateElementsSpy).not.toHaveBeenCalled();
  });

  it('AC-7: bringForward on a bound container skips its label as the swap target', () => {
    bringForward('container');

    expect(getZIndex('label')).toBe(getZIndex('container') + 1);
    expect(getZIndex('container')).toBeGreaterThan(getZIndex('other'));
    expect(updateElementsSpy).toHaveBeenCalledOnce();
    const ids = (updateElementsSpy.mock.calls[0][0] as { id: string }[]).map((patch) => patch.id);
    expect(ids).toEqual(['container', 'label', 'other']);
  });
});
