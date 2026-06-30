import type { Point, Rect } from '../../../types/geometry';
import type { ResizeHandleId, ResizeSession } from '../../../types/interaction';
import type { Element } from '../../../types/shared';
import { resizePointGeometry } from './point-geometry';

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

export function getResizeAnchor(el: Element, handle: ResizeHandleId): Point {
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

export function fitTextBoundsToFontScale(
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

export function computeTextResizeFontSize(
  el: Element,
  session: ResizeSession,
  bounds: { width: number; height: number },
): number {
  const originalFontSize = el.props.fontSize ?? 16;
  return Math.max(1, originalFontSize * computeTextResizeScale(session, bounds));
}

export function computeResizeProps(
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
