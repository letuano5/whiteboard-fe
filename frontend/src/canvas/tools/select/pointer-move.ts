import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Point } from '../../../types/geometry';
import { normalizeLinearBounds, rotatePoint, unrotatePoint } from '../../../utils/geometry';
import { computeBoundArrowDrafts, computeMultiDragDrafts } from './bound-arrows';
import { normalizeRect } from './geometry';
import { translatePointGeometry } from './point-geometry';
import {
  computeResizeProps,
  fitBoundsToAspectRatio,
  fitTextBoundsToFontScale,
  resizeBoundsFromAnchorAndPointer,
} from './resize';

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
    // @covers AC-8: add non-selected arrows bound to any selected element
    setDraftElements(computeMultiDragDrafts(selectedIds, dx, dy, allElements));
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
    const draftEl = { ...el, angle };
    setDraftElement(draftEl);
    setDraftElements(computeBoundArrowDrafts(draftEl, useElementsStore.getState().elements));
    return;
  }

  // @covers AC-6: endpoint handle drag — update only the dragged endpoint in props.points
  const resizeHandle = useInteractionStore.getState().resizeHandle;
  if (resizeHandle === 'ep-start' || resizeHandle === 'ep-end') {
    const pointIdx = resizeHandle === 'ep-start' ? 0 : 1;
    const pts = el.props.points;
    if (!pts || pts.length < 2) return;
    const newPoints: [number, number][] = [
      [pts[0][0], pts[0][1]],
      [pts[1][0], pts[1][1]],
    ];
    newPoints[pointIdx] = [worldPt.x, worldPt.y];
    const bbox = normalizeLinearBounds(newPoints);
    setDraftElement({ ...el, ...bbox, props: { ...el.props, points: newPoints } });
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
      } =
        el.type === 'image'
          ? fitBoundsToAspectRatio(resizeSession, rawBounds, activeHandle)
          : el.type === 'text'
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
      const draftEl = {
        ...el,
        ...bounds,
        props: computeResizeProps(el, resizeSession, bounds, flippedX, flippedY),
      };
      setDraftElement(draftEl);
      setDraftElements(computeBoundArrowDrafts(draftEl, useElementsStore.getState().elements));
      setResizeHandle(activeHandle);
    } else {
      const { flippedX, flippedY, activeHandle, ...rawBounds } = resizeBoundsFromAnchorAndPointer(
        resizeSession,
        worldPt,
      );
      const bounds =
        el.type === 'image'
          ? fitBoundsToAspectRatio(resizeSession, rawBounds, activeHandle)
          : el.type === 'text'
            ? fitTextBoundsToFontScale(resizeSession, rawBounds, activeHandle)
            : rawBounds;
      const draftEl = {
        ...el,
        ...bounds,
        props: computeResizeProps(el, resizeSession, bounds, flippedX, flippedY),
      };
      setDraftElement(draftEl);
      setDraftElements(computeBoundArrowDrafts(draftEl, useElementsStore.getState().elements));
      setResizeHandle(activeHandle);
    }
  } else {
    const dx = worldPt.x - dragStart.x;
    const dy = worldPt.y - dragStart.y;
    // @covers AC-8: find arrows bound to the dragged element and update in draft layer
    const draftEl = {
      ...el,
      x: el.x + dx,
      y: el.y + dy,
      props: translatePointGeometry(el, dx, dy),
    };
    setDraftElement(draftEl);
    setDraftElements(computeBoundArrowDrafts(draftEl, useElementsStore.getState().elements));
  }
}
