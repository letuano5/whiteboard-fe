import type { Element } from '@vdt/shared';

/**
 * Result of getRoomDiff:
 * - mode 'diff': incremental update — only changed/deleted elements since lastServerClock.
 * - mode 'wipe': tombstone history too short — full snapshot (wipe-all fallback).
 *
 * @covers AC-1, AC-8, AC-10, AC-12
 */
export type RoomDiffResult =
  | { mode: 'diff'; changed: Element[]; deleted: Array<{ id: string }>; documentClock: number }
  | { mode: 'wipe'; elements: Element[]; documentClock: number };

export interface SaveRoomElementsResult {
  /** New documentClock after the transaction. */
  documentClock: bigint;
}

export interface LoadRoomResult {
  /** Active (non-deleted) elements loaded from DB. */
  elements: Element[];
  /** documentClock converted from BigInt at repository boundary. */
  documentClock: number;
}
