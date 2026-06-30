import { patchElement, updateElements } from '../../../store/mutation-pipeline';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import type { Point } from '../../../types/geometry';
import { findNearestSnap, parseBinding } from '../../shapes/arrow-binding';
import { rectsIntersect } from './geometry';

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

  // @covers AC-8: commit multi-drag (pure multi-select, no single-element draftElement)
  if (draftElements.length > 0 && !draftElement) {
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

  // @covers AC-9: single drag with bound arrow drafts — commit bound arrows then fall through
  if (draftElements.length > 0 && draftElement) {
    updateElements(
      draftElements.map((el) => ({
        id: el.id,
        patch: { x: el.x, y: el.y, props: el.props },
      })),
    );
    setDraftElements([]);
  }

  if (draggingId && dragStart && draftElement) {
    // AC-2: commit rotate via patchElement
    if (isRotating) {
      patchElement(draggingId, { angle: draftElement.angle });
    } else if (draftElement.type === 'arrow' && draftElement.props.points) {
      // Arrow: apply snap binding regardless of how drag started (endpoint handle or resize)
      const elements = useElementsStore.getState().elements;
      const points = draftElement.props.points;
      const existingEl = elements.find((e) => e.id === draggingId);
      const originalPoints = existingEl?.props.points;

      // Detect which endpoint moved (compare draft points vs original)
      let movedIdx = -1;
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
            // Only update startBinding; leave endBinding untouched
            resolvedProps = { ...resolvedProps, points: newPoints, startBinding: bindingStr };
          } else {
            // Only update endBinding; leave startBinding untouched
            resolvedProps = { ...resolvedProps, points: newPoints, endBinding: bindingStr };
          }
        } else {
          // No snap — release binding only for the moved endpoint
          if (movedIdx === 0 && parseBinding(resolvedProps.startBinding)) {
            resolvedProps = { ...resolvedProps, startBinding: undefined };
          } else if (movedIdx !== 0 && parseBinding(resolvedProps.endBinding)) {
            resolvedProps = { ...resolvedProps, endBinding: undefined };
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
    } else if (resizeSession) {
      // Non-arrow resize
      patchElement(draggingId, {
        x: draftElement.x,
        y: draftElement.y,
        width: draftElement.width,
        height: draftElement.height,
        ...(draftElement.props.points || draftElement.type === 'text'
          ? { props: draftElement.props }
          : {}),
      });
    } else {
      // Plain move
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
  setDraftElements([]);
}
