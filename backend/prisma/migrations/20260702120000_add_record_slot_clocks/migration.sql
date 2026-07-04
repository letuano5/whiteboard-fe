-- AlterTable: add slotClocks JSON column to Record
-- Stores per-slot clock metadata as { [slot]: { clock, lastActorId?, lastRequestId? } }
-- recordClock invariant: recordClock = max(slotClocks[*].clock) for any touched record.
ALTER TABLE "Record" ADD COLUMN "slotClocks" JSONB NOT NULL DEFAULT '{}';
