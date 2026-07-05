import type { Element, ElementProps } from '../../types/shared';
import type { Point } from '../../types/geometry';
import { useInteractionStore } from '../../store/interaction.store';
import { useDefaultStyleStore } from '../../store/default-style.store';
import { createElement, type ElementDraft } from '../../store/mutation-pipeline';
import {
  appendDistinctFreehandPoint,
  boundsForFreehandPoints,
  MAX_POINTS_PER_FREEHAND_STROKE,
  simplifyFreehandPoints,
  splitFreehandStrokeAtCap,
  toFreehandPoint,
  type FreehandPoint,
} from '../freehand-points';

type InkToolType = 'freehand' | 'highlighter';

// Highlighter styling is intentionally fixed (not user-configurable) — see P3C-03 decision.
const HIGHLIGHTER_PROPS: ElementProps = {
  strokeColor: '#facc15',
  fillColor: 'transparent',
  strokeWidth: 14,
  strokeStyle: 'solid',
  opacity: 0.35,
};

function getInkProps(type: InkToolType): ElementProps {
  if (type === 'highlighter') return HIGHLIGHTER_PROPS;

  const style = useDefaultStyleStore.getState();
  return {
    strokeColor: style.strokeColor,
    fillColor: style.fillColor,
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    opacity: style.opacity,
  };
}

let activeRawPoints: FreehandPoint[] = [];
let activeInkTool: InkToolType = 'freehand';

function buildInkDraft(
  type: InkToolType,
  rawPoints: FreehandPoint[],
  createdBy = '',
): ElementDraft | null {
  const points = simplifyFreehandPoints(rawPoints);
  if (points.length < 2) return null;

  return {
    type,
    ...boundsForFreehandPoints(points),
    angle: 0,
    props: {
      ...getInkProps(type),
      points,
    },
    groupId: null,
    frameId: null,
    locked: false,
    createdBy,
  };
}

function buildDraftElement(type: InkToolType, rawPoints: FreehandPoint[]): Element | null {
  const draft = buildInkDraft(type, rawPoints);
  if (!draft) return null;

  return {
    ...draft,
    id: `__${type}_draft__`,
    zIndex: 0,
    version: 0,
    versionNonce: 0,
    updatedAt: 0,
    isDeleted: false,
  };
}

function commitRawPoints(
  type: InkToolType,
  rawPoints: FreehandPoint[],
  createdBy = '',
): Element | null {
  const draft = buildInkDraft(type, rawPoints, createdBy);
  return draft ? createElement(draft) : null;
}

function refreshDraft(): void {
  useInteractionStore.getState().setDraftElement(buildDraftElement(activeInkTool, activeRawPoints));
}

function appendPointAndSplitIfNeeded(point: FreehandPoint, createdBy = ''): void {
  activeRawPoints = appendDistinctFreehandPoint(activeRawPoints, point);
  const split = splitFreehandStrokeAtCap(activeRawPoints, MAX_POINTS_PER_FREEHAND_STROKE);

  if (split.committed) {
    commitRawPoints(activeInkTool, split.committed, createdBy);
    activeRawPoints = split.active;
    const [startX, startY] = activeRawPoints[0];
    useInteractionStore.getState().setDragStart({ x: startX, y: startY });
  }
}

function onInkPointerDown(type: InkToolType, worldPt: Point): void {
  activeInkTool = type;
  activeRawPoints = [toFreehandPoint(worldPt)];
  const { setDragStart, setDraftElement } = useInteractionStore.getState();
  setDragStart(worldPt);
  setDraftElement(null);
}

function onInkPointerMove(type: InkToolType, worldPt: Point, createdBy = ''): void {
  if (activeRawPoints.length === 0) return;
  activeInkTool = type;
  appendPointAndSplitIfNeeded(toFreehandPoint(worldPt), createdBy);
  refreshDraft();
}

function onInkPointerUp(type: InkToolType, worldPt: Point, createdBy = ''): void {
  if (activeRawPoints.length > 0) {
    activeInkTool = type;
    appendPointAndSplitIfNeeded(toFreehandPoint(worldPt), createdBy);
    commitRawPoints(type, activeRawPoints, createdBy);
  }

  activeRawPoints = [];
  const { setDragStart, setDraftElement } = useInteractionStore.getState();
  setDragStart(null);
  setDraftElement(null);
}

function cancelInkDraw(): void {
  activeRawPoints = [];
  const { setDragStart, setDraftElement } = useInteractionStore.getState();
  setDragStart(null);
  setDraftElement(null);
}

export function onFreehandPointerDown(worldPt: Point): void {
  onInkPointerDown('freehand', worldPt);
}

export function onFreehandPointerMove(worldPt: Point, createdBy = ''): void {
  onInkPointerMove('freehand', worldPt, createdBy);
}

export function onFreehandPointerUp(worldPt: Point, createdBy = ''): void {
  onInkPointerUp('freehand', worldPt, createdBy);
}

export function cancelFreehandDraw(): void {
  cancelInkDraw();
}

export function onHighlighterPointerDown(worldPt: Point): void {
  onInkPointerDown('highlighter', worldPt);
}

export function onHighlighterPointerMove(worldPt: Point, createdBy = ''): void {
  onInkPointerMove('highlighter', worldPt, createdBy);
}

export function onHighlighterPointerUp(worldPt: Point, createdBy = ''): void {
  onInkPointerUp('highlighter', worldPt, createdBy);
}

export function cancelHighlighterDraw(): void {
  cancelInkDraw();
}
