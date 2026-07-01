import type { Element } from '@vdt/shared';

export function isPreviewElement(value: unknown): value is Element {
  if (typeof value !== 'object' || value === null) return false;
  const element = value as Record<string, unknown>;
  return (
    typeof element.id === 'string' &&
    typeof element.type === 'string' &&
    typeof element.x === 'number' &&
    typeof element.y === 'number' &&
    typeof element.width === 'number' &&
    typeof element.height === 'number' &&
    typeof element.zIndex === 'number' &&
    typeof element.isDeleted === 'boolean' &&
    element.props !== null &&
    typeof element.props === 'object'
  );
}
