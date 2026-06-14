import type React from 'react';
import type { Element, ElementType } from '../../types/shared';
import type { Rect } from '../../types/geometry';
import type { HandleId } from '../../types/interaction';

export interface ShapeUtil<T extends Element = Element> {
  readonly type: ElementType;
  render(element: T): React.ReactElement;
  hitTest(element: T, x: number, y: number): boolean;
  getBounds(element: T): Rect;
  resize(element: T, handle: HandleId, dx: number, dy: number): Partial<Element>;
}
