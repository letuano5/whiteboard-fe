import type { Element } from '../index';
import type { SyncSlot } from './types';

export type ElementSyncFieldClassification =
  | { category: 'identity' }
  | { category: 'slot'; slot: SyncSlot }
  | { category: 'legacy-only' }
  | { category: 'non-sync'; reason: string };

export const ELEMENT_FIELD_SYNC_CLASSIFICATION = {
  id: { category: 'identity' },
  type: { category: 'identity' },
  x: { category: 'slot', slot: 'transform.position' },
  y: { category: 'slot', slot: 'transform.position' },
  width: { category: 'slot', slot: 'transform.size' },
  height: { category: 'slot', slot: 'transform.size' },
  angle: { category: 'slot', slot: 'transform.rotation' },
  zIndex: { category: 'slot', slot: 'order' },
  props: { category: 'non-sync', reason: 'Container only; individual props map below.' },
  version: { category: 'legacy-only' },
  versionNonce: { category: 'legacy-only' },
  updatedAt: { category: 'legacy-only' },
  isDeleted: { category: 'non-sync', reason: 'Deletion is represented by DeleteElementsCommand.' },
  groupId: { category: 'slot', slot: 'grouping.groupId' },
  frameId: { category: 'slot', slot: 'grouping.frameId' },
  locked: { category: 'slot', slot: 'state.locked' },
  createdBy: { category: 'identity' },
} as const satisfies Record<keyof Element, ElementSyncFieldClassification>;

export const ELEMENT_PROPS_FIELD_SYNC_CLASSIFICATION = {
  strokeColor: { category: 'slot', slot: 'style.strokeColor' },
  fillColor: { category: 'slot', slot: 'style.fillColor' },
  strokeWidth: { category: 'slot', slot: 'style.strokeWidth' },
  strokeStyle: { category: 'slot', slot: 'style.strokeStyle' },
  opacity: { category: 'slot', slot: 'style.opacity' },
  roughness: { category: 'slot', slot: 'style.roughness' },
  points: { category: 'slot', slot: 'geometry.points' },
  text: { category: 'slot', slot: 'text.text' },
  fontSize: { category: 'slot', slot: 'text.fontSize' },
  fontFamily: { category: 'slot', slot: 'text.fontFamily' },
  textAlign: { category: 'slot', slot: 'text.textAlign' },
  src: { category: 'slot', slot: 'asset.src' },
  startBinding: { category: 'slot', slot: 'binding.start' },
  endBinding: { category: 'slot', slot: 'binding.end' },
  url: { category: 'slot', slot: 'embed.url' },
} as const satisfies Record<keyof Element['props'], ElementSyncFieldClassification>;
