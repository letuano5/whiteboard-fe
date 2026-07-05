import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isShapeTool,
  buildDraftFromPoints,
  isValidSize,
  SHAPE_TOOLS,
  onShapePointerUp,
} from '../create-shape-tool';
import { useInteractionStore } from '../../../store/interaction.store';
import { useDefaultStyleStore, DEFAULT_STYLE_INITIAL } from '../../../store/default-style.store';
import * as pipeline from '../../../store/mutation-pipeline';
import type { Point } from '../../../types/geometry';

const pt = (x: number, y: number): Point => ({ x, y });

describe('isShapeTool', () => {
  it('returns true for all shape tools', () => {
    for (const t of SHAPE_TOOLS) {
      expect(isShapeTool(t)).toBe(true);
    }
  });

  it('returns false for non-shape tools', () => {
    expect(isShapeTool('select')).toBe(false);
    expect(isShapeTool('hand')).toBe(false);
    expect(isShapeTool('eraser')).toBe(false);
  });
});

describe('buildDraftFromPoints — rectangle', () => {
  it('drag right-down: correct bounds', () => {
    const result = buildDraftFromPoints('rectangle', pt(10, 20), pt(60, 80));
    expect(result).toMatchObject({ type: 'rectangle', x: 10, y: 20, width: 50, height: 60 });
  });

  it('drag left-up (negative direction): normalizes correctly', () => {
    const result = buildDraftFromPoints('rectangle', pt(60, 80), pt(10, 20));
    expect(result).toMatchObject({ type: 'rectangle', x: 10, y: 20, width: 50, height: 60 });
  });

  it('uses default props', () => {
    const result = buildDraftFromPoints('rectangle', pt(0, 0), pt(100, 100));
    expect(result.props.strokeColor).toBe('#1a1a1a');
    expect(result.props.fillColor).toBe('transparent');
    expect(result.props.strokeWidth).toBe(2);
    expect(result.props.strokeStyle).toBe('solid');
    expect(result.props.opacity).toBe(1);
  });

  it('picks up a customized default style from the default style store', () => {
    useDefaultStyleStore.getState().setDefaultStyle({ strokeColor: '#ff00ff', strokeWidth: 9 });

    const result = buildDraftFromPoints('rectangle', pt(0, 0), pt(100, 100));
    expect(result.props.strokeColor).toBe('#ff00ff');
    expect(result.props.strokeWidth).toBe(9);
  });

  afterEach(() => {
    useDefaultStyleStore.setState({ ...DEFAULT_STYLE_INITIAL });
  });
});

describe('buildDraftFromPoints — ellipse', () => {
  it('normalizes negative drag', () => {
    const result = buildDraftFromPoints('ellipse', pt(100, 100), pt(50, 30));
    expect(result).toMatchObject({ type: 'ellipse', x: 50, y: 30, width: 50, height: 70 });
  });
});

describe('buildDraftFromPoints — diamond / triangle / polygon (H5 audit fix)', () => {
  it.each(['diamond', 'triangle', 'polygon'] as const)(
    '%s: builds a bbox draft like rectangle',
    (type) => {
      const result = buildDraftFromPoints(type, pt(60, 80), pt(10, 20));
      expect(result).toMatchObject({ type, x: 10, y: 20, width: 50, height: 60 });
    },
  );
});

describe('buildDraftFromPoints — line', () => {
  it('stores props.points with absolute world coords', () => {
    const result = buildDraftFromPoints('line', pt(10, 20), pt(90, 60));
    expect(result.props.points).toEqual([[10, 20], [90, 60]]);
  });

  it('bounding box: normalizes for negative direction', () => {
    const result = buildDraftFromPoints('line', pt(90, 60), pt(10, 20));
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
    expect(result.width).toBe(80);
    expect(result.height).toBe(40);
    // points still use absolute coords (not normalized)
    expect(result.props.points).toEqual([[90, 60], [10, 20]]);
  });
});

describe('buildDraftFromPoints — text', () => {
  it('has text-specific default props', () => {
    const result = buildDraftFromPoints('text', pt(0, 0), pt(200, 50));
    expect(result.props.text).toBe('Text');
    expect(result.props.fontSize).toBe(16);
    expect(result.props.fontFamily).toBe('sans-serif');
    expect(result.props.textAlign).toBe('left');
  });

  it('normalizes bounds like rectangle', () => {
    const result = buildDraftFromPoints('text', pt(200, 50), pt(0, 0));
    expect(result).toMatchObject({ x: 0, y: 0, width: 200, height: 50 });
  });

  it('picks up a customized default font size/family/align', () => {
    useDefaultStyleStore.getState().setDefaultStyle({
      fontSize: 32,
      fontFamily: 'monospace',
      textAlign: 'center',
    });

    const result = buildDraftFromPoints('text', pt(0, 0), pt(200, 50));
    expect(result.props.fontSize).toBe(32);
    expect(result.props.fontFamily).toBe('monospace');
    expect(result.props.textAlign).toBe('center');

    useDefaultStyleStore.setState({ ...DEFAULT_STYLE_INITIAL });
  });
});

// @covers AC-19
describe('onShapePointerUp — text click-to-create', () => {
  let createSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createSpy = vi.spyOn(pipeline, 'createElement').mockImplementation(
      () => ({}) as ReturnType<typeof pipeline.createElement>,
    );
    useInteractionStore.getState().setDragStart({ x: 100, y: 200 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useInteractionStore.getState().reset();
  });

  it('creates text with default 200×40 when click (start === end)', () => {
    onShapePointerUp('text', { x: 100, y: 200 });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text',
        x: 100,
        y: 200,
        width: 200,
        height: 40,
        props: expect.objectContaining({ text: 'Text' }),
      }),
    );
  });

  it('creates text with default 200×40 when drag is too small (< 5px)', () => {
    onShapePointerUp('text', { x: 103, y: 203 });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'text', x: 100, y: 200, width: 200, height: 40 }),
    );
  });

  it('creates text with dragged bounds when drag is large enough', () => {
    onShapePointerUp('text', { x: 310, y: 250 });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'text', x: 100, y: 200, width: 210, height: 50 }),
    );
  });

  it('does not create when dragStart is null', () => {
    useInteractionStore.getState().setDragStart(null);
    onShapePointerUp('text', { x: 100, y: 200 });
    expect(createSpy).not.toHaveBeenCalled();
  });
});

// @covers FR-011 — auto-enter edit mode when text is created
describe('onShapePointerUp — text auto-enters edit mode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useInteractionStore.getState().reset();
  });

  it('sets editingId to the new element id after click-to-create', () => {
    vi.spyOn(pipeline, 'createElement').mockReturnValue(
      { id: 'new-text-1' } as ReturnType<typeof pipeline.createElement>,
    );
    useInteractionStore.getState().setDragStart({ x: 50, y: 50 });

    onShapePointerUp('text', { x: 50, y: 50 }); // click, no drag

    expect(useInteractionStore.getState().editingId).toBe('new-text-1');
  });

  it('sets selectedIds to [new element id] after click-to-create', () => {
    vi.spyOn(pipeline, 'createElement').mockReturnValue(
      { id: 'new-text-1' } as ReturnType<typeof pipeline.createElement>,
    );
    useInteractionStore.getState().setDragStart({ x: 50, y: 50 });

    onShapePointerUp('text', { x: 50, y: 50 });

    expect(useInteractionStore.getState().selectedIds).toEqual(['new-text-1']);
  });

  it('sets editingId to the new element id after drag-to-create', () => {
    vi.spyOn(pipeline, 'createElement').mockReturnValue(
      { id: 'new-text-2' } as ReturnType<typeof pipeline.createElement>,
    );
    useInteractionStore.getState().setDragStart({ x: 0, y: 0 });

    onShapePointerUp('text', { x: 200, y: 60 }); // large drag

    expect(useInteractionStore.getState().editingId).toBe('new-text-2');
  });

  it('does NOT set editingId for non-text shapes', () => {
    vi.spyOn(pipeline, 'createElement').mockReturnValue(
      { id: 'rect-1' } as ReturnType<typeof pipeline.createElement>,
    );
    useInteractionStore.getState().setDragStart({ x: 0, y: 0 });

    onShapePointerUp('rectangle', { x: 100, y: 100 });

    expect(useInteractionStore.getState().editingId).toBeNull();
  });

  it('keeps the active tool unchanged after text creation (no auto-switch to select)', () => {
    vi.spyOn(pipeline, 'createElement').mockReturnValue(
      { id: 'new-text-3' } as ReturnType<typeof pipeline.createElement>,
    );
    useInteractionStore.getState().setDragStart({ x: 50, y: 50 });
    useInteractionStore.getState().setTool('text');

    onShapePointerUp('text', { x: 50, y: 50 });

    expect(useInteractionStore.getState().tool).toBe('text');
  });

  it('keeps the active tool unchanged after a non-text shape is drag-created', () => {
    vi.spyOn(pipeline, 'createElement').mockReturnValue(
      { id: 'rect-1' } as ReturnType<typeof pipeline.createElement>,
    );
    useInteractionStore.getState().setDragStart({ x: 0, y: 0 });
    useInteractionStore.getState().setTool('rectangle');

    onShapePointerUp('rectangle', { x: 100, y: 100 });

    expect(useInteractionStore.getState().tool).toBe('rectangle');
  });
});

describe('isValidSize', () => {
  it('returns true when rectangle is large enough', () => {
    expect(isValidSize('rectangle', pt(0, 0), pt(10, 10))).toBe(true);
  });

  it('returns false when width is too small', () => {
    expect(isValidSize('rectangle', pt(0, 0), pt(3, 10))).toBe(false);
  });

  it('returns false when height is too small', () => {
    expect(isValidSize('rectangle', pt(0, 0), pt(10, 3))).toBe(false);
  });

  it('returns false when both dimensions are too small', () => {
    expect(isValidSize('ellipse', pt(0, 0), pt(4, 4))).toBe(false);
  });

  it('line: uses distance, not separate w/h', () => {
    // diagonal: sqrt(3^2 + 4^2) = 5 → exactly at threshold
    expect(isValidSize('line', pt(0, 0), pt(3, 4))).toBe(true);
  });

  it('line: too short', () => {
    expect(isValidSize('line', pt(0, 0), pt(2, 2))).toBe(false);
  });

  it('works for negative-direction drag (same as positive)', () => {
    expect(isValidSize('rectangle', pt(100, 100), pt(90, 90))).toBe(true);
    expect(isValidSize('rectangle', pt(100, 100), pt(97, 97))).toBe(false);
  });
});
