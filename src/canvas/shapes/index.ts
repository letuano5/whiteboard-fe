import type { ElementType } from '../../types/shared';
import type { ShapeUtil } from './types';
import { rectangleShapeUtil } from './rectangle';
import { ellipseShapeUtil } from './ellipse';
import { diamondShapeUtil } from './diamond';
import { lineShapeUtil } from './line';
import { textShapeUtil } from './text';

const registry = new Map<ElementType, ShapeUtil>();

export function registerShapeUtil(util: ShapeUtil): void {
  registry.set(util.type, util);
}

export function getShapeUtil(type: ElementType): ShapeUtil | undefined {
  return registry.get(type);
}

registerShapeUtil(rectangleShapeUtil);
registerShapeUtil(ellipseShapeUtil);
registerShapeUtil(diamondShapeUtil);
registerShapeUtil(lineShapeUtil);
registerShapeUtil(textShapeUtil);
