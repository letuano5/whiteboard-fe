import type { Element } from '@vdt/shared';

export interface AutosaveManagerOptions {
  /** Time in ms to wait before flushing after a dirty mark. Default: 5000. */
  delayMs?: number;
  /** Returns the current in-memory elements for a room. */
  getRoomElements: (roomId: string) => Element[];
  /** Persists elements to durable storage. Returns the new documentClock. */
  saveRoomElements: (roomId: string, elements: Element[]) => Promise<unknown>;
  /** Logger used for error reporting. Defaults to console. */
  logger?: Pick<typeof console, 'error' | 'info'>;
}

export interface AutosaveManager {
  /**
   * Marks a room dirty and schedules a delayed flush if none is pending.
   * Safe to call on every element-update event; timer is not reset on repeat calls.
   */
  markDirty: (roomId: string) => void;
  /**
   * Cancels any pending timer and flushes the room immediately.
   * Used when the last client disconnects (AC-7).
   */
  flushRoomNow: (roomId: string) => Promise<void>;
}

/**
 * Creates an autosave manager that batches dirty rooms and flushes them
 * after a configurable delay or immediately when the room becomes empty.
 *
 * The manager keeps runtime state in three collections:
 * - `dirtyRooms` – rooms with unsaved changes.
 * - `timers`     – one scheduled flush per dirty room.
 * - `inFlight`   – rooms whose flush is currently running (prevents overlap).
 *
 * On flush failure: the error is logged and the dirty flag is kept so a
 * subsequent `markDirty` or `flushRoomNow` can retry.  No automatic retry
 * timer is scheduled; this avoids unbounded retry loops while still satisfying
 * AC-10 (room stays dirty → later flush can succeed).
 */
export function createAutosaveManager({
  delayMs = 5000,
  getRoomElements,
  saveRoomElements,
  logger = console,
}: AutosaveManagerOptions): AutosaveManager {
  const dirtyRooms = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const inFlight = new Set<string>();

  async function flush(roomId: string): Promise<void> {
    // Clear any scheduled timer so we don't double-flush
    const existing = timers.get(roomId);
    if (existing !== undefined) {
      clearTimeout(existing);
      timers.delete(roomId);
    }

    // Skip if not dirty (AC-9: clean room guard)
    if (!dirtyRooms.has(roomId)) {
      return;
    }

    // Prevent overlapping flushes; a later markDirty will reschedule.
    if (inFlight.has(roomId)) {
      return;
    }

    // Snapshot the latest in-memory state before marking inflight
    const elements = getRoomElements(roomId);
    if (elements.length === 0) {
      // Nothing to write; mark clean
      dirtyRooms.delete(roomId);
      return;
    }

    inFlight.add(roomId);
    try {
      await saveRoomElements(roomId, elements);
      // Mark clean only after a successful write (AC-10: keep dirty on failure)
      dirtyRooms.delete(roomId);
    } catch (err) {
      // AC-10: log error, keep dirty flag set — next markDirty or flushRoomNow retries.
      logger.error(`[autosave] Failed to flush room ${roomId}:`, err);
    } finally {
      inFlight.delete(roomId);
    }
  }

  function scheduleFlush(roomId: string): void {
    if (timers.has(roomId)) {
      // Timer already pending; do not reset it (AC-5: first dirty schedules, no re-schedule)
      return;
    }
    const timer = setTimeout(() => {
      timers.delete(roomId);
      flush(roomId).catch((err: unknown) => {
        logger.error(`[autosave] Unhandled error flushing room ${roomId}:`, err);
      });
    }, delayMs);
    timers.set(roomId, timer);
  }

  return {
    markDirty(roomId: string): void {
      dirtyRooms.add(roomId);
      scheduleFlush(roomId);
    },

    async flushRoomNow(roomId: string): Promise<void> {
      await flush(roomId);
    },
  };
}
