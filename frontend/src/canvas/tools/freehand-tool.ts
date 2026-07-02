import type { Element, ElementProps } from '../../types/shared';
import type { Point } from '../../types/geometry';
import { useInteractionStore } from '../../store/interaction.store';
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

const FREEHAND_PROPS: ElementProps = {
  strokeColor: '#1a1a1a',
  fillColor: 'transparent',
  strokeWidth: 3,
  strokeStyle: 'solid',
  opacity: 1,
};

let activeRawPoints: FreehandPoint[] = [];

function buildFreehandDraft(rawPoints: FreehandPoint[], createdBy = ''): ElementDraft | null {
  const points = simplifyFreehandPoints(rawPoints);
  if (points.length < 2) return null;

  return {
    type: 'freehand',
    ...boundsForFreehandPoints(points),
    angle: 0,
    props: {
      ...FREEHAND_PROPS,
      points,
    },
    groupId: null,
    frameId: null,
    locked: false,
    createdBy,
  };
}

function buildDraftElement(rawPoints: FreehandPoint[]): Element | null {
  const draft = buildFreehandDraft(rawPoints);
  if (!draft) return null;

  return {
    ...draft,
    id: '__freehand_draft__',
    zIndex: 0,
    version: 0,
    versionNonce: 0,
    updatedAt: 0,
    isDeleted: false,
  };
}

function commitRawPoints(rawPoints: FreehandPoint[], createdBy = ''): Element | null {
  const draft = buildFreehandDraft(rawPoints, createdBy);
  return draft ? createElement(draft) : null;
}

function refreshDraft(): void {
  useInteractionStore.getState().setDraftElement(buildDraftElement(activeRawPoints));
}

function appendPointAndSplitIfNeeded(point: FreehandPoint, createdBy = ''): void {
  activeRawPoints = appendDistinctFreehandPoint(activeRawPoints, point);
  const split = splitFreehandStrokeAtCap(activeRawPoints, MAX_POINTS_PER_FREEHAND_STROKE);

  if (split.committed) {
    commitRawPoints(split.committed, createdBy);
    activeRawPoints = split.active;
    const [startX, startY] = activeRawPoints[0];
    useInteractionStore.getState().setDragStart({ x: startX, y: startY });
  }
}

export function onFreehandPointerDown(worldPt: Point): void {
  activeRawPoints = [toFreehandPoint(worldPt)];
  const { setDragStart, setDraftElement } = useInteractionStore.getState();
  setDragStart(worldPt);
  setDraftElement(null);
}

export function onFreehandPointerMove(worldPt: Point, createdBy = ''): void {
  if (activeRawPoints.length === 0) return;
  appendPointAndSplitIfNeeded(toFreehandPoint(worldPt), createdBy);
  refreshDraft();
}

export function onFreehandPointerUp(worldPt: Point, createdBy = ''): void {
  if (activeRawPoints.length > 0) {
    appendPointAndSplitIfNeeded(toFreehandPoint(worldPt), createdBy);
    commitRawPoints(activeRawPoints, createdBy);
  }

  activeRawPoints = [];
  const { setDragStart, setDraftElement } = useInteractionStore.getState();
  setDragStart(null);
  setDraftElement(null);
}

export function cancelFreehandDraw(): void {
  activeRawPoints = [];
  const { setDragStart, setDraftElement } = useInteractionStore.getState();
  setDragStart(null);
  setDraftElement(null);
}
