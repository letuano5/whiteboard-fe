import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { patchElement, deleteElements } from '../../store/mutation-pipeline';
import { getShapeUtil } from '../shapes';
import { unrotatePoint } from '../../utils/geometry';
import type { Point, Rect } from '../../types/geometry';
import type { ResizeHandleId, ResizeSession } from '../../types/interaction';
import type { Element } from '../../types/shared';

const MIN_RESIZE_SIZE = 1;
const HORIZONTAL_FLIP: Record<ResizeHandleId, ResizeHandleId> = {
  nw: 'ne',
  ne: 'nw',
  sw: 'se',
  se: 'sw',
  n: 'n',
  s: 's',
  e: 'w',
  w: 'e',
};
const VERTICAL_FLIP: Record<ResizeHandleId, ResizeHandleId> = {
  nw: 'sw',
  ne: 'se',
  sw: 'nw',
  se: 'ne',
  n: 's',
  s: 'n',
  e: 'e',
  w: 'w',
};

function affectsLeft(handle: ResizeHandleId): boolean {
  return handle === 'nw' || handle === 'sw' || handle === 'w';
}

function affectsRight(handle: ResizeHandleId): boolean {
  return handle === 'ne' || handle === 'se' || handle === 'e';
}

function affectsTop(handle: ResizeHandleId): boolean {
  return handle === 'nw' || handle === 'ne' || handle === 'n';
}

function affectsBottom(handle: ResizeHandleId): boolean {
  return handle === 'sw' || handle === 'se' || handle === 's';
}

function getResizeAnchor(el: Element, handle: ResizeHandleId): Point {
  return {
    x: affectsLeft(handle)
      ? el.x + el.width
      : affectsRight(handle)
        ? el.x
        : el.x + el.width / 2,
    y: affectsTop(handle)
      ? el.y + el.height
      : affectsBottom(handle)
        ? el.y
        : el.y + el.height / 2,
  };
}

export function getFlippedHandle(
  originalHandle: ResizeHandleId,
  flippedX: boolean,
  flippedY: boolean,
): ResizeHandleId {
  const horizontallyFlipped = flippedX ? HORIZONTAL_FLIP[originalHandle] : originalHandle;
  return flippedY ? VERTICAL_FLIP[horizontallyFlipped] : horizontallyFlipped;
}

export function resizeBoundsFromAnchorAndPointer(
  session: ResizeSession,
  pointer: Point,
): Rect & {
  flippedX: boolean;
  flippedY: boolean;
  activeHandle: ResizeHandleId;
} {
  const { originalBounds, originalHandle, anchor } = session;
  const changesX = affectsLeft(originalHandle) || affectsRight(originalHandle);
  const changesY = affectsTop(originalHandle) || affectsBottom(originalHandle);
  const pointerIsLeft =
    pointer.x === anchor.x ? affectsLeft(originalHandle) : pointer.x < anchor.x;
  const pointerIsTop =
    pointer.y === anchor.y ? affectsTop(originalHandle) : pointer.y < anchor.y;
  const flippedX =
    changesX &&
    ((affectsLeft(originalHandle) && !pointerIsLeft) ||
      (affectsRight(originalHandle) && pointerIsLeft));
  const flippedY =
    changesY &&
    ((affectsTop(originalHandle) && !pointerIsTop) ||
      (affectsBottom(originalHandle) && pointerIsTop));

  let x = originalBounds.x;
  let y = originalBounds.y;
  let width = originalBounds.width;
  let height = originalBounds.height;

  if (changesX) {
    width = Math.max(MIN_RESIZE_SIZE, Math.abs(pointer.x - anchor.x));
    x = pointerIsLeft ? anchor.x - width : anchor.x;
  }
  if (changesY) {
    height = Math.max(MIN_RESIZE_SIZE, Math.abs(pointer.y - anchor.y));
    y = pointerIsTop ? anchor.y - height : anchor.y;
  }

  return {
    x,
    y,
    width,
    height,
    flippedX,
    flippedY,
    activeHandle: getFlippedHandle(originalHandle, flippedX, flippedY),
  };
}

function translatePointGeometry(el: Element, dx: number, dy: number): Element['props'] {
  if (!el.props.points) return el.props;
  return {
    ...el.props,
    points: el.props.points.map(([x, y]) => [x + dx, y + dy]),
  };
}

function resizePointGeometry(
  el: Element,
  bounds: { x: number; y: number; width: number; height: number },
  flippedX: boolean,
  flippedY: boolean,
): Element['props'] {
  const points = el.props.points;
  if (!points) return el.props;

  return {
    ...el.props,
    points: points.map(([px, py], index) => {
      const sequenceRatio = points.length <= 1 ? 0 : index / (points.length - 1);
      const xRatio =
        el.width !== 0
          ? (px - el.x) / el.width
          : el.height !== 0
            ? (py - el.y) / el.height
            : sequenceRatio;
      const yRatio =
        el.height !== 0
          ? (py - el.y) / el.height
          : el.width !== 0
            ? (px - el.x) / el.width
            : sequenceRatio;

      const transformedXRatio = flippedX ? 1 - xRatio : xRatio;
      const transformedYRatio = flippedY ? 1 - yRatio : yRatio;

      return [
        bounds.x + transformedXRatio * bounds.width,
        bounds.y + transformedYRatio * bounds.height,
      ];
    }),
  };
}

export function onSelectPointerDown(worldPt: Point): void {
  const elements = useElementsStore.getState().elements;
  const visible = elements.filter((el) => !el.isDeleted).sort((a, b) => b.zIndex - a.zIndex);
  const {
    setSelectedIds,
    setDraggingId,
    setDragStart,
    setResizeHandle,
    setResizeSession,
  } = useInteractionStore.getState();

  for (const el of visible) {
    const util = getShapeUtil(el.type);
    // AC-5/AC-6: un-rotate the test point into the element's local frame before AABB hit-test
    const center = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    const localPt = el.angle !== 0 ? unrotatePoint(worldPt, center, el.angle) : worldPt;
    if (util && util.hitTest(el, localPt.x, localPt.y)) {
      setSelectedIds([el.id]);
      setDraggingId(el.id);
      setDragStart(worldPt);
      setResizeHandle(null);
      setResizeSession(null);
      return;
    }
  }
  setSelectedIds([]);
  setDraggingId(null);
  setDragStart(null);
  setResizeHandle(null);
  setResizeSession(null);
}

export function onSelectHandlePointerDown(handle: ResizeHandleId, worldPt: Point): void {
  const {
    selectedIds,
    setDraggingId,
    setDragStart,
    setResizeHandle,
    setResizeSession,
  } = useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  const selected = useElementsStore
    .getState()
    .elements.find((el) => el.id === selectedIds[0] && !el.isDeleted);
  if (!selected) return;

  setDraggingId(selected.id);
  setDragStart(worldPt);
  setResizeHandle(handle);
  setResizeSession({
    originalBounds: {
      x: selected.x,
      y: selected.y,
      width: selected.width,
      height: selected.height,
    },
    originalHandle: handle,
    anchor: getResizeAnchor(selected, handle),
  });
}

export function computeResize(
  el: Element,
  handle: ResizeHandleId,
  worldPt: Point,
): ReturnType<typeof resizeBoundsFromAnchorAndPointer> {
  return resizeBoundsFromAnchorAndPointer(
    {
      originalBounds: { x: el.x, y: el.y, width: el.width, height: el.height },
      originalHandle: handle,
      anchor: getResizeAnchor(el, handle),
    },
    worldPt,
  );
}

export function onSelectPointerMove(worldPt: Point): void {
  const {
    draggingId,
    dragStart,
    resizeSession,
    isRotating,
    setDraftElement,
    setResizeHandle,
  } = useInteractionStore.getState();
  if (!draggingId || !dragStart) return;

  const elements = useElementsStore.getState().elements;
  const el = elements.find((e) => e.id === draggingId);
  if (!el) return;

  // AC-1: rotate branch — compute angle from element center to pointer, offset by π/2
  if (isRotating) {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const rawAngle = Math.atan2(worldPt.y - cy, worldPt.x - cx) + Math.PI / 2;
    const angle = ((rawAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
    setDraftElement({ ...el, angle });
    return;
  }

  if (resizeSession) {
    // AC-8: un-rotate pointer into element's local frame so resize works for rotated shapes.
    // Anchor is already in local coordinates (getResizeAnchor uses el.x/y/width/height directly).
    const effectivePointer =
      el.angle !== 0
        ? unrotatePoint(worldPt, {
            x: resizeSession.originalBounds.x + resizeSession.originalBounds.width / 2,
            y: resizeSession.originalBounds.y + resizeSession.originalBounds.height / 2,
          }, el.angle)
        : worldPt;
    const { x, y, width, height, flippedX, flippedY, activeHandle } =
      resizeBoundsFromAnchorAndPointer(resizeSession, effectivePointer);
    const bounds = { x, y, width, height };
    setDraftElement({
      ...el,
      ...bounds,
      props: resizePointGeometry(el, bounds, flippedX, flippedY),
    });
    setResizeHandle(activeHandle);
  } else {
    const dx = worldPt.x - dragStart.x;
    const dy = worldPt.y - dragStart.y;
    setDraftElement({
      ...el,
      x: el.x + dx,
      y: el.y + dy,
      props: translatePointGeometry(el, dx, dy),
    });
  }
}

export function onSelectPointerUp(_worldPt: Point): void {
  const {
    draggingId,
    dragStart,
    draftElement,
    resizeSession,
    isRotating,
    setDraggingId,
    setDragStart,
    setResizeHandle,
    setResizeSession,
    setIsRotating,
    setDraftElement,
  } = useInteractionStore.getState();

  if (draggingId && dragStart && draftElement) {
    // AC-2: commit rotate via patchElement
    if (isRotating) {
      patchElement(draggingId, { angle: draftElement.angle });
    } else if (resizeSession) {
      patchElement(draggingId, {
        x: draftElement.x,
        y: draftElement.y,
        width: draftElement.width,
        height: draftElement.height,
        ...(draftElement.props.points ? { props: draftElement.props } : {}),
      });
    } else {
      patchElement(draggingId, {
        x: draftElement.x,
        y: draftElement.y,
        ...(draftElement.props.points ? { props: draftElement.props } : {}),
      });
    }
  }

  setDraggingId(null);
  setDragStart(null);
  setResizeHandle(null);
  setResizeSession(null);
  setIsRotating(false);
  setDraftElement(null);
}

// AC-1: initiate rotate drag on the selected element
export function onRotateHandlePointerDown(worldPt: Point): void {
  const { selectedIds, setDraggingId, setDragStart, setIsRotating } =
    useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  const el = useElementsStore
    .getState()
    .elements.find((e) => e.id === selectedIds[0] && !e.isDeleted);
  if (!el) return;
  setDraggingId(el.id);
  setDragStart(worldPt);
  setIsRotating(true);
}

export function onSelectKeyDown(key: string): void {
  const { selectedIds, setSelectedIds } = useInteractionStore.getState();
  if ((key === 'Delete' || key === 'Backspace') && selectedIds.length > 0) {
    deleteElements(selectedIds);
    setSelectedIds([]);
  }
}
