import type { Element } from '@vdt/shared';

/**
 * Factory for creating test Element objects with sensible defaults.
 * Overrides are merged on top of defaults.
 */
export function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'element-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 12345,
    updatedAt: Date.now(),
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test-user',
    ...overrides,
  };
}

/** Creates a deleted (tombstone candidate) element. */
export function makeDeletedElement(overrides: Partial<Element> = {}): Element {
  return makeElement({ isDeleted: true, ...overrides });
}
