import type { Element, PendingRequestStatus, SlotClockUpdate } from '@vdt/shared';

/**
 * Result of getRoomDiff:
 * - mode 'diff': incremental update — only changed/deleted elements since lastServerClock.
 *   slotClocks contains only the slots whose clock > lastServerClock (2-step filter).
 * - mode 'wipe': tombstone history too short — full snapshot (wipe-all fallback).
 *   slotClocks contains all slot clocks for the returned elements.
 *
 * @covers AC-1, AC-8, AC-10, AC-12
 */
export type RoomDiffResult =
  | {
      mode: 'diff';
      changed: Element[];
      deleted: Array<{ id: string }>;
      documentClock: number;
      serverClock: number;
      roomEpoch: number;
      fromClock: number;
      toClock: number;
      slotClocks: SlotClockUpdate[];
      hasMore: boolean;
      nextFromClock?: number;
      pendingRequests?: PendingRequestStatus[];
    }
  | {
      mode: 'wipe';
      elements: Element[];
      documentClock: number;
      serverClock: number;
      roomEpoch: number;
      slotClocks: SlotClockUpdate[];
      processedRequestHistoryStartsAtClock?: number;
      pendingRequests?: PendingRequestStatus[];
    };

export interface SaveRoomElementsResult {
  /** New documentClock after the transaction. */
  documentClock: bigint;
}

export interface LoadRoomResult {
  /** Active (non-deleted) elements loaded from DB. */
  elements: Element[];
  /** documentClock converted from BigInt at repository boundary. */
  documentClock: number;
  /** P5 room epoch converted from BigInt at repository boundary. */
  roomEpoch: number;
  /** Slot-level clock metadata from Record.slotClocks JSON. */
  slotClocks: SlotClockUpdate[];
  /** Deleted record IDs retained by tombstone history. */
  tombstoneElementIds: string[];
  /** Optional lower bound for retained processed request history. */
  processedRequestHistoryStartsAtClock?: number;
}

/**
 * Per-slot clock entry stored in Record.slotClocks JSON column.
 * Invariant: recordClock = max(slotClocks[*].clock) for all slots.
 */
export interface RecordSlotClockEntry {
  clock: number;
  lastActorId?: string;
  lastRequestId?: string;
}

export type RecordSlotClocksJson = Record<string, RecordSlotClockEntry>;
