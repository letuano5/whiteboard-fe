import type { Element } from '../../types/shared';
import type { Point } from '../../types/geometry';
import { useInteractionStore } from '../../store/interaction.store';
import { useElementsStore } from '../../store/elements.store';
import { deleteElements } from '../../store/mutation-pipeline';
import { getShapeUtil } from '../shapes';

const SWEEP_SAMPLE_SPACING = 4;

let previousPoint: Point | null = null;
let erasedIds = new Set<string>();

function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function segmentSamples(start: Point, end: Point): Point[] {
  const sampleCount = Math.max(1, Math.ceil(distance(start, end) / SWEEP_SAMPLE_SPACING));
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const t = index / sampleCount;
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    };
  });
}

export function findEraserHitIds(elements: Element[], start: Point, end: Point): string[] {
  const samples = segmentSamples(start, end);
  const hitIds: string[] = [];
  const seenIds = new Set<string>();

  for (const element of elements) {
    if (element.isDeleted) continue;
    const util = getShapeUtil(element.type);
    if (!util) continue;

    const hit = samples.some((sample) => util.hitTest(element, sample.x, sample.y));
    if (hit && !seenIds.has(element.id)) {
      hitIds.push(element.id);
      seenIds.add(element.id);
    }
  }

  return hitIds;
}

function eraseSegment(start: Point, end: Point): void {
  const elements = useElementsStore.getState().elements;
  const hitIds = findEraserHitIds(elements, start, end).filter((id) => !erasedIds.has(id));
  if (hitIds.length === 0) return;

  hitIds.forEach((id) => erasedIds.add(id));
  deleteElements(hitIds);
}

export function onEraserPointerDown(worldPt: Point): void {
  previousPoint = worldPt;
  erasedIds = new Set();
  useInteractionStore.getState().setDragStart(worldPt);
  eraseSegment(worldPt, worldPt);
}

export function onEraserPointerMove(worldPt: Point): void {
  if (!previousPoint) return;
  eraseSegment(previousPoint, worldPt);
  previousPoint = worldPt;
}

export function onEraserPointerUp(worldPt: Point): void {
  if (previousPoint) {
    eraseSegment(previousPoint, worldPt);
  }
  cancelEraserDrag();
}

export function cancelEraserDrag(): void {
  previousPoint = null;
  erasedIds = new Set();
  useInteractionStore.getState().setDragStart(null);
}
