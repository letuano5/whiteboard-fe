import type { Element, ElementProps } from '../../types/shared';
import type { Point } from '../../types/geometry';
import type { ToolId } from '../../types/interaction';
import { useInteractionStore } from '../../store/interaction.store';
import { createElement, type ElementDraft } from '../../store/mutation-pipeline';

export const SHAPE_TOOLS = ['rectangle', 'ellipse', 'line', 'arrow', 'text'] as const;
export type ShapeToolType = (typeof SHAPE_TOOLS)[number];

export function isShapeTool(tool: ToolId): tool is ShapeToolType {
  return (SHAPE_TOOLS as readonly string[]).includes(tool);
}

const DEFAULT_PROPS: ElementProps = {
  strokeColor: '#1a1a1a',
  fillColor: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 1,
};

const TEXT_EXTRA: Partial<ElementProps> = {
  strokeColor: '#1a1a1a',
  fillColor: 'transparent',
  strokeWidth: 1,
  text: 'Text',
  fontSize: 16,
  fontFamily: 'sans-serif',
  textAlign: 'left',
};

function getDefaultProps(type: ShapeToolType): ElementProps {
  if (type === 'text') return { ...DEFAULT_PROPS, ...TEXT_EXTRA };
  return { ...DEFAULT_PROPS };
}

export function buildDraftFromPoints(
  type: ShapeToolType,
  start: Point,
  current: Point,
): Omit<ElementDraft, 'createdBy' | 'groupId' | 'frameId' | 'locked' | 'angle'> {
  const props = getDefaultProps(type);

  if (type === 'line' || type === 'arrow') {
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    return {
      type,
      x,
      y,
      width,
      height,
      props: {
        ...props,
        points: [
          [start.x, start.y],
          [current.x, current.y],
        ],
      },
    };
  }

  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  return { type, x, y, width, height, props };
}

function makeDraftElement(type: ShapeToolType, start: Point, current: Point): Element {
  const partial = buildDraftFromPoints(type, start, current);
  return {
    ...partial,
    id: '__draft__',
    angle: 0,
    zIndex: 0,
    version: 0,
    versionNonce: 0,
    updatedAt: 0,
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: '',
  };
}

export function isValidSize(type: ShapeToolType, start: Point, current: Point): boolean {
  const MIN = 5;
  if (type === 'line' || type === 'arrow') {
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    return Math.sqrt(dx * dx + dy * dy) >= MIN;
  }
  return Math.abs(current.x - start.x) >= MIN && Math.abs(current.y - start.y) >= MIN;
}

export function onShapePointerDown(type: ShapeToolType, worldPt: Point): void {
  const { setDragStart, setDraftElement } = useInteractionStore.getState();
  setDragStart(worldPt);
  setDraftElement(makeDraftElement(type, worldPt, worldPt));
}

export function onShapePointerMove(type: ShapeToolType, worldPt: Point): void {
  const { dragStart, setDraftElement } = useInteractionStore.getState();
  if (!dragStart) return;
  setDraftElement(makeDraftElement(type, dragStart, worldPt));
}

export function onShapePointerUp(
  type: ShapeToolType,
  worldPt: Point,
  createdBy: string = '',
): void {
  const { dragStart, setDragStart, setDraftElement, setTool, setEditingId, setSelectedIds } =
    useInteractionStore.getState();

  if (dragStart && isValidSize(type, dragStart, worldPt)) {
    const partial = buildDraftFromPoints(type, dragStart, worldPt);
    const draft: ElementDraft = {
      ...partial,
      angle: 0,
      groupId: null,
      frameId: null,
      locked: false,
      createdBy,
    };
    const el = createElement(draft);
    setTool('select');
    if (type === 'text') {
      setSelectedIds([el.id]);
      setEditingId(el.id);
    }
  } else if (dragStart && type === 'text') {
    // Click-to-create text: use a default bounding box when no meaningful drag occurred
    const draft: ElementDraft = {
      type: 'text',
      x: dragStart.x,
      y: dragStart.y,
      width: 200,
      height: 40,
      props: getDefaultProps('text'),
      angle: 0,
      groupId: null,
      frameId: null,
      locked: false,
      createdBy,
    };
    const el = createElement(draft);
    setTool('select');
    setSelectedIds([el.id]);
    setEditingId(el.id);
  }

  setDragStart(null);
  setDraftElement(null);
}

export function cancelShapeDraw(): void {
  const { setDragStart, setDraftElement } = useInteractionStore.getState();
  setDragStart(null);
  setDraftElement(null);
}
