import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import {
  patchElement,
  deleteElements,
  updateElements,
  createElements,
  type ElementDraft,
} from '../../store/mutation-pipeline';
import { findNearestSnap, parseBinding } from '../shapes/arrow-binding';
import { getShapeUtil } from '../shapes';
import { rotatePoint, unrotatePoint } from '../../utils/geometry';
import type { Point, Rect } from '../../types/geometry';
import type { ResizeHandleId, ResizeSession } from '../../types/interaction';
import type { Element } from '../../types/shared';

function normalizeRect(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

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
    x: affectsLeft(handle) ? el.x + el.width : affectsRight(handle) ? el.x : el.x + el.width / 2,
    y: affectsTop(handle) ? el.y + el.height : affectsBottom(handle) ? el.y : el.y + el.height / 2,
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
  const pointerIsLeft = pointer.x === anchor.x ? affectsLeft(originalHandle) : pointer.x < anchor.x;
  const pointerIsTop = pointer.y === anchor.y ? affectsTop(originalHandle) : pointer.y < anchor.y;
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

function boundsFromAnchorAndSize(
  anchor: Point,
  activeHandle: ResizeHandleId,
  width: number,
  height: number,
): Rect {
  return {
    x: affectsLeft(activeHandle)
      ? anchor.x - width
      : affectsRight(activeHandle)
        ? anchor.x
        : anchor.x - width / 2,
    y: affectsTop(activeHandle)
      ? anchor.y - height
      : affectsBottom(activeHandle)
        ? anchor.y
        : anchor.y - height / 2,
    width,
    height,
  };
}

export function computeTextResizeScale(
  session: ResizeSession,
  bounds: { width: number; height: number },
): number {
  const ratios: number[] = [];
  if (affectsLeft(session.originalHandle) || affectsRight(session.originalHandle)) {
    ratios.push(session.originalBounds.width > 0 ? bounds.width / session.originalBounds.width : 1);
  }
  if (affectsTop(session.originalHandle) || affectsBottom(session.originalHandle)) {
    ratios.push(
      session.originalBounds.height > 0 ? bounds.height / session.originalBounds.height : 1,
    );
  }
  if (ratios.length === 0) return 1;

  const minRatio = Math.min(...ratios);
  const maxRatio = Math.max(...ratios);
  const rawScale = minRatio < 1 ? minRatio : maxRatio;
  const minWidthScale =
    session.originalBounds.width > 0 ? MIN_RESIZE_SIZE / session.originalBounds.width : 1;
  const minHeightScale =
    session.originalBounds.height > 0 ? MIN_RESIZE_SIZE / session.originalBounds.height : 1;
  return Math.max(rawScale, minWidthScale, minHeightScale);
}

function fitTextBoundsToFontScale(
  session: ResizeSession,
  bounds: Rect,
  activeHandle: ResizeHandleId,
): Rect {
  const scale = computeTextResizeScale(session, bounds);
  return boundsFromAnchorAndSize(
    session.anchor,
    activeHandle,
    Math.max(MIN_RESIZE_SIZE, session.originalBounds.width * scale),
    Math.max(MIN_RESIZE_SIZE, session.originalBounds.height * scale),
  );
}

function computeResizeProps(
  el: Element,
  session: ResizeSession,
  bounds: { x: number; y: number; width: number; height: number },
  flippedX: boolean,
  flippedY: boolean,
): Element['props'] {
  const baseProps = resizePointGeometry(el, bounds, flippedX, flippedY);
  if (el.type !== 'text') return baseProps;
  return {
    ...baseProps,
    fontSize: computeTextResizeFontSize(el, session, bounds),
  };
}

export function computeTextResizeFontSize(
  el: Element,
  session: ResizeSession,
  bounds: { width: number; height: number },
): number {
  const originalFontSize = el.props.fontSize ?? 16;
  return Math.max(1, originalFontSize * computeTextResizeScale(session, bounds));
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

export function onSelectPointerDown(worldPt: Point, shiftKey = false): void {
  const elements = useElementsStore.getState().elements;
  const visible = elements.filter((el) => !el.isDeleted).sort((a, b) => b.zIndex - a.zIndex);
  const {
    selectedIds,
    setSelectedIds,
    setDraggingId,
    setDragStart,
    setResizeHandle,
    setResizeSession,
    setMarquee,
  } = useInteractionStore.getState();

  for (const el of visible) {
    const util = getShapeUtil(el.type);
    const center = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    const localPt = el.angle !== 0 ? unrotatePoint(worldPt, center, el.angle) : worldPt;
    if (util && util.hitTest(el, localPt.x, localPt.y)) {
      setMarquee(null);
      if (shiftKey) {
        // @covers AC-4, AC-5, AC-6: shift-click toggles element in/out of selection
        const alreadySelected = selectedIds.includes(el.id);
        const newIds = alreadySelected
          ? selectedIds.filter((id) => id !== el.id)
          : [...selectedIds, el.id];
        setSelectedIds(newIds);
        setDraggingId(null);
        setDragStart(null);
      } else if (selectedIds.includes(el.id)) {
        // Already selected: keep multi-selection, start drag
        setDraggingId(el.id);
        setDragStart(worldPt);
        setResizeHandle(null);
        setResizeSession(null);
      } else {
        // Replace selection with this element
        setSelectedIds([el.id]);
        setDraggingId(el.id);
        setDragStart(worldPt);
        setResizeHandle(null);
        setResizeSession(null);
      }
      return;
    }
  }

  // Miss: start marquee drag; @covers AC-3, AC-7
  if (!shiftKey) setSelectedIds([]);
  setDraggingId(null);
  setDragStart(worldPt);
  setResizeHandle(null);
  setResizeSession(null);
  setMarquee(normalizeRect(worldPt, worldPt));
}

export function onSelectHandlePointerDown(handle: ResizeHandleId, worldPt: Point): void {
  const { selectedIds, setDraggingId, setDragStart, setResizeHandle, setResizeSession } =
    useInteractionStore.getState();
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
    marquee,
    selectedIds,
    setDraftElement,
    setDraftElements,
    setMarquee,
    setResizeHandle,
  } = useInteractionStore.getState();

  // @covers AC-1, AC-2: update marquee rect while dragging (only when NOT dragging an element)
  if (marquee !== null && dragStart && !draggingId) {
    setMarquee(normalizeRect(dragStart, worldPt));
    return;
  }

  if (!draggingId || !dragStart) return;

  // @covers AC-8: multi-drag — move all selected elements together
  if (selectedIds.length > 1) {
    const dx = worldPt.x - dragStart.x;
    const dy = worldPt.y - dragStart.y;
    const allElements = useElementsStore.getState().elements;
    const drafts = allElements
      .filter((el) => selectedIds.includes(el.id) && !el.isDeleted)
      .map((el) => ({
        ...el,
        x: el.x + dx,
        y: el.y + dy,
        props: translatePointGeometry(el, dx, dy),
      }));
    setDraftElements(drafts);
    return;
  }

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
    if (el.angle !== 0) {
      // AC-8: resize in local frame; anchor stays at the same WORLD position.
      // 1. Compute anchor world position from original bounds (constant during drag).
      const center0 = {
        x: resizeSession.originalBounds.x + resizeSession.originalBounds.width / 2,
        y: resizeSession.originalBounds.y + resizeSession.originalBounds.height / 2,
      };
      const anchorWorld = rotatePoint(resizeSession.anchor, center0, el.angle);

      // 2. Un-rotate world pointer into element local frame.
      const localPointer = unrotatePoint(worldPt, center0, el.angle);

      // 3. Compute new dimensions in local frame.
      const { flippedX, flippedY, activeHandle, ...rawBounds } = resizeBoundsFromAnchorAndPointer(
        resizeSession,
        localPointer,
      );
      const {
        x: xl,
        y: yl,
        width,
        height,
      } = el.type === 'text'
        ? fitTextBoundsToFontScale(resizeSession, rawBounds, activeHandle)
        : rawBounds;

      // 4. The session.anchor may be at any corner/edge of the new box.
      //    Compute its fraction within the new box (0=min edge, 1=max edge).
      const fx = (resizeSession.anchor.x - xl) / width;
      const fy = (resizeSession.anchor.y - yl) / height;

      // 5. Find the new center so that the anchor lands on anchorWorld after rotation.
      //    anchorWorld = center1 + rotateVector({(fx-0.5)*w, (fy-0.5)*h}, angle)
      const cos = Math.cos(el.angle);
      const sin = Math.sin(el.angle);
      const dax = (fx - 0.5) * width;
      const day = (fy - 0.5) * height;
      const cx1 = anchorWorld.x - (dax * cos - day * sin);
      const cy1 = anchorWorld.y - (dax * sin + day * cos);

      const bounds = { x: cx1 - width / 2, y: cy1 - height / 2, width, height };
      setDraftElement({
        ...el,
        ...bounds,
        props: computeResizeProps(el, resizeSession, bounds, flippedX, flippedY),
      });
      setResizeHandle(activeHandle);
    } else {
      const { flippedX, flippedY, activeHandle, ...rawBounds } = resizeBoundsFromAnchorAndPointer(
        resizeSession,
        worldPt,
      );
      const bounds =
        el.type === 'text'
          ? fitTextBoundsToFontScale(resizeSession, rawBounds, activeHandle)
          : rawBounds;
      setDraftElement({
        ...el,
        ...bounds,
        props: computeResizeProps(el, resizeSession, bounds, flippedX, flippedY),
      });
      setResizeHandle(activeHandle);
    }
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
    draftElements,
    marquee,
    resizeSession,
    isRotating,
    setSelectedIds,
    setDraggingId,
    setDragStart,
    setResizeHandle,
    setResizeSession,
    setIsRotating,
    setDraftElement,
    setDraftElements,
    setMarquee,
  } = useInteractionStore.getState();

  // @covers AC-1, AC-2, AC-3: commit marquee selection (only when not dragging an element)
  if (marquee !== null && !draggingId && dragStart) {
    const elements = useElementsStore.getState().elements;
    const hits = elements
      .filter(
        (el) =>
          !el.isDeleted &&
          rectsIntersect(marquee, { x: el.x, y: el.y, width: el.width, height: el.height }),
      )
      .map((el) => el.id);
    setSelectedIds(hits);
    setMarquee(null);
    setDragStart(null);
    return;
  }

  // @covers AC-8: commit multi-drag
  if (draftElements.length > 0) {
    updateElements(
      draftElements.map((el) => ({
        id: el.id,
        patch: { x: el.x, y: el.y, ...(el.props.points ? { props: el.props } : {}) },
      })),
    );
    setDraftElements([]);
    setDraggingId(null);
    setDragStart(null);
    return;
  }

  if (draggingId && dragStart && draftElement) {
    // AC-2: commit rotate via patchElement
    if (isRotating) {
      patchElement(draggingId, { angle: draftElement.angle });
    } else if (resizeSession) {
      // T022: Arrow endpoint binding snap — check if resizing an arrow endpoint
      if (draftElement.type === 'arrow' && draftElement.props.points) {
        const elements = useElementsStore.getState().elements;
        const points = draftElement.props.points;
        const existingEl = elements.find((e) => e.id === draggingId);
        const originalPoints = existingEl?.props.points;

        // Detect which endpoint moved (compare draft points vs original)
        let movedIdx: 0 | (typeof points.length extends 0 ? never : number) = -1;
        if (originalPoints && points.length > 0) {
          if (
            Math.abs(points[0][0] - (originalPoints[0]?.[0] ?? 0)) > 0.5 ||
            Math.abs(points[0][1] - (originalPoints[0]?.[1] ?? 0)) > 0.5
          ) {
            movedIdx = 0;
          } else {
            movedIdx = points.length - 1;
          }
        }

        let resolvedProps = { ...draftElement.props };

        if (movedIdx >= 0) {
          const movedPt = { x: points[movedIdx][0], y: points[movedIdx][1] };
          const snap = findNearestSnap(movedPt, elements, draggingId);
          const newPoints: [number, number][] = points.map((p) => [p[0], p[1]]);

          if (snap) {
            newPoints[movedIdx] = [snap.x, snap.y];
            const bindingStr = `${snap.elementId}:${snap.pointKey}`;
            if (movedIdx === 0) {
              resolvedProps = { ...resolvedProps, points: newPoints, startBinding: bindingStr };
            } else {
              resolvedProps = { ...resolvedProps, points: newPoints, endBinding: bindingStr };
            }
          } else {
            // No snap — release binding for the moved endpoint
            if (movedIdx === 0) {
              const parsed = parseBinding(resolvedProps.startBinding);
              if (parsed) {
                resolvedProps = { ...resolvedProps, startBinding: undefined };
              }
            } else {
              const parsed = parseBinding(resolvedProps.endBinding);
              if (parsed) {
                resolvedProps = { ...resolvedProps, endBinding: undefined };
              }
            }
          }
        }

        patchElement(draggingId, {
          x: draftElement.x,
          y: draftElement.y,
          width: draftElement.width,
          height: draftElement.height,
          props: resolvedProps,
        });
      } else {
        patchElement(draggingId, {
          x: draftElement.x,
          y: draftElement.y,
          width: draftElement.width,
          height: draftElement.height,
          ...(draftElement.props.points || draftElement.type === 'text'
            ? { props: draftElement.props }
            : {}),
        });
      }
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

function cloneAsNewDraft(el: Element, offsetX: number, offsetY: number): ElementDraft {
  return {
    type: el.type,
    x: el.x + offsetX,
    y: el.y + offsetY,
    width: el.width,
    height: el.height,
    angle: el.angle,
    props: el.props.points
      ? { ...el.props, points: el.props.points.map(([px, py]) => [px + offsetX, py + offsetY]) }
      : { ...el.props },
    groupId: el.groupId,
    frameId: el.frameId,
    locked: el.locked,
    createdBy: el.createdBy,
  };
}

// @covers AC-11, AC-12, AC-13
export function onDuplicateSelected(): void {
  const { selectedIds, setSelectedIds } = useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  const elements = useElementsStore.getState().elements;
  const originals = elements.filter((el) => selectedIds.includes(el.id) && !el.isDeleted);
  if (originals.length === 0) return;

  const drafts = originals.map((el) => cloneAsNewDraft(el, 10, 10));
  const created = createElements(drafts);
  setSelectedIds(created.map((el) => el.id));
}

// @covers AC-14
export function onCopySelected(): void {
  const { selectedIds, setClipboard, setPasteOffset } = useInteractionStore.getState();
  if (selectedIds.length === 0) return;
  const elements = useElementsStore.getState().elements;
  const originals = elements.filter((el) => selectedIds.includes(el.id) && !el.isDeleted);
  if (originals.length === 0) return;

  setClipboard(originals.map((el) => ({ ...el, props: { ...el.props } })));
  setPasteOffset(0);
}

// @covers AC-15, AC-16, AC-17
export function onPasteSelected(): void {
  const { clipboard, pasteOffset, setSelectedIds, setClipboard, setPasteOffset } =
    useInteractionStore.getState();
  if (!clipboard || clipboard.length === 0) return;

  const nextOffset = pasteOffset + 1;
  const delta = nextOffset * 10;
  const drafts = clipboard.map((el) => cloneAsNewDraft(el, delta, delta));
  const created = createElements(drafts);
  setSelectedIds(created.map((el) => el.id));
  setClipboard(clipboard); // keep clipboard populated
  setPasteOffset(nextOffset);
}

export function onSelectKeyDown(key: string, ctrlOrMeta = false): void {
  const { selectedIds, setSelectedIds } = useInteractionStore.getState();
  if ((key === 'Delete' || key === 'Backspace') && selectedIds.length > 0) {
    deleteElements(selectedIds);
    setSelectedIds([]);
    return;
  }
  if (ctrlOrMeta) {
    if (key === 'd') {
      onDuplicateSelected();
    } else if (key === 'c') {
      onCopySelected();
    } else if (key === 'v') {
      onPasteSelected();
    }
  }
}
