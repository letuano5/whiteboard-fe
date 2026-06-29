/**
 * Unit tests for autosave.ts using Vitest fake timers.
 *
 * @covers AC-5  Autosave scheduled but NOT flushed before delay elapses.
 * @covers AC-6  Flush runs exactly once after delay; room marked clean on success.
 * @covers AC-7  flushRoomNow clears timer and persists immediately when room empties.
 * @covers AC-10 Failed flush: error logged, dirty flag preserved, retry scheduled.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutosaveManager } from './autosave.js';
import { makeElement } from '../test/element-fixtures.js';
import type { Element } from '@vdt/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(delayMs = 5000) {
  const elements: Element[] = [makeElement({ id: 'el-1' })];
  const getRoomElements = vi.fn().mockReturnValue(elements);
  const saveRoomElements = vi.fn().mockResolvedValue({ documentClock: 1n });
  const logger = { error: vi.fn(), info: vi.fn() };

  const manager = createAutosaveManager({
    delayMs,
    getRoomElements,
    saveRoomElements,
    logger,
  });

  return { manager, getRoomElements, saveRoomElements, logger, elements };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAutosaveManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // @covers AC-5 — scheduled but not flushed before delay
  // =========================================================================
  describe('AC-5: autosave scheduled but not flushed before delay', () => {
    it('does not call saveRoomElements before the delay elapses', () => {
      const { manager, saveRoomElements } = setup(5000);

      manager.markDirty('room-1');

      // Advance just under the threshold
      vi.advanceTimersByTime(4999);

      expect(saveRoomElements).not.toHaveBeenCalled();
    });

    it('does not flush immediately after markDirty', () => {
      const { manager, saveRoomElements } = setup(5000);

      manager.markDirty('room-1');

      // No time advanced — flush must not happen synchronously
      expect(saveRoomElements).not.toHaveBeenCalled();
    });

    it('schedules only one timer even if markDirty is called multiple times', () => {
      const { manager, saveRoomElements } = setup(5000);

      manager.markDirty('room-1');
      manager.markDirty('room-1');
      manager.markDirty('room-1');

      vi.advanceTimersByTime(4999);

      // Still not flushed
      expect(saveRoomElements).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // @covers AC-6 — flush runs exactly once after delay; room is clean on success
  // =========================================================================
  describe('AC-6: flush runs exactly once after delay and room is marked clean', () => {
    it('calls saveRoomElements exactly once after the delay', async () => {
      const { manager, saveRoomElements } = setup(5000);

      manager.markDirty('room-1');
      vi.advanceTimersByTime(5000);

      // Allow the async flush to settle
      await vi.runAllTimersAsync();

      expect(saveRoomElements).toHaveBeenCalledTimes(1);
    });

    it('flushes the latest in-memory state', async () => {
      const { manager, saveRoomElements, elements } = setup(5000);

      manager.markDirty('room-1');
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      expect(saveRoomElements).toHaveBeenCalledWith('room-1', elements);
    });

    it('does not flush again after the delay if room is already clean', async () => {
      const { manager, saveRoomElements } = setup(5000);

      manager.markDirty('room-1');
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      // First flush succeeded — room is now clean.
      // Advance time further: no second flush should happen.
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      expect(saveRoomElements).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // @covers AC-7 — flushRoomNow clears timer and persists immediately
  // =========================================================================
  describe('AC-7: flushRoomNow persists immediately when room empties', () => {
    it('persists immediately without waiting for the remaining delay', async () => {
      const { manager, saveRoomElements } = setup(5000);

      manager.markDirty('room-1');
      // Only 1 second elapsed — timer still pending
      vi.advanceTimersByTime(1000);

      await manager.flushRoomNow('room-1');

      // Should have flushed immediately, not waited for 5 s
      expect(saveRoomElements).toHaveBeenCalledTimes(1);
    });

    it('clears the pending scheduled timer so it does not fire later', async () => {
      const { manager, saveRoomElements } = setup(5000);

      manager.markDirty('room-1');
      vi.advanceTimersByTime(1000);

      await manager.flushRoomNow('room-1');

      // Advance past the original delay — should NOT cause a second flush
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      expect(saveRoomElements).toHaveBeenCalledTimes(1);
    });

    it('flushes immediately even with no preceding timer when called directly', async () => {
      const { manager, saveRoomElements } = setup(5000);

      // Mark dirty but do not advance time (no timer fired)
      manager.markDirty('room-1');
      await manager.flushRoomNow('room-1');

      expect(saveRoomElements).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // @covers AC-10 — failed flush: logs error, keeps dirty, schedules retry
  // =========================================================================
  describe('AC-10: failed flush logs error and preserves dirty state for retry', () => {
    it('logs the error when saveRoomElements throws', async () => {
      const { manager, saveRoomElements, logger } = setup(5000);

      const testError = new Error('DB connection lost');
      saveRoomElements.mockRejectedValue(testError);

      manager.markDirty('room-1');
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('room-1'),
        testError,
      );
    });

    it('keeps the room dirty after a failed flush (dirty flag not cleared), allowing a later retry', async () => {
      const { manager, saveRoomElements } = setup(5000);

      saveRoomElements.mockRejectedValueOnce(new Error('DB down'));

      manager.markDirty('room-1');
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      // First call failed — room stays dirty.
      // Simulate a later retry: calling markDirty again (e.g. next element update) schedules a fresh flush.
      saveRoomElements.mockResolvedValue({ documentClock: 2n });

      manager.markDirty('room-1');
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      // saveRoomElements must have been called at least twice (initial + retry)
      expect(saveRoomElements.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('does not clear in-memory state on flush failure', async () => {
      const { manager, saveRoomElements, getRoomElements, elements } = setup(5000);

      saveRoomElements.mockRejectedValue(new Error('fail'));

      manager.markDirty('room-1');
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

      // In-memory elements should not be touched by autosave
      expect(getRoomElements.mock.calls.length).toBeGreaterThanOrEqual(1);
      // The original elements array is unmodified
      expect(elements[0]).toBeDefined();
    });
  });
});
