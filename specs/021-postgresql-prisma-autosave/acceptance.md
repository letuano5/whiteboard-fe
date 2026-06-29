# Acceptance Criteria Registry: PostgreSQL Prisma Autosave

> **Frozen** - IDs are append-only and immutable after generation.
> Source: `spec.md` User Stories and Functional Requirements.

## AC Registry

| ID | Source | Criterion |
|----|--------|-----------|
| AC-1 | US1 AC-1, FR-001, FR-003, FR-005 | Given an existing room with no saved records, when a live element update is received and autosave is flushed, then the room exists in durable storage and the non-deleted element is saved as an active record containing the full element state. |
| AC-2 | US1 AC-2, FR-004 | Given multiple elements are committed in one batch, when autosave writes the batch, then `documentClock` increments exactly once for that transaction and every active record in the batch receives the same `recordClock`. |
| AC-3 | US2 AC-1, FR-006 | Given a room has an active record, when an update batch contains the same element with `isDeleted = true`, then the active record is removed and a tombstone is stored for that element id with the transaction clock. |
| AC-4 | US2 AC-2, FR-007 | Given a later active update for a previously tombstoned element is accepted, when autosave flushes that update, then the active record is upserted and the old tombstone for that element is cleared. |
| AC-5 | US3 AC-1, FR-008 | Given a room receives one or more element updates, when fewer than 5 seconds have elapsed with the default autosave delay, then autosave is scheduled but no persistence flush has executed yet. |
| AC-6 | US3 AC-2, FR-008, FR-010 | Given a room has pending updates, when the configured autosave delay elapses, then the latest in-memory state for that room is flushed exactly once and the room is marked clean on success. |
| AC-7 | US3 AC-3, FR-009 | Given a room has pending updates and its last client disconnects, when room presence reaches zero clients, then pending updates flush immediately instead of waiting for the remaining throttle delay. |
| AC-8 | US4 AC-1, FR-002 | Given the database write is pending or slow, when the backend receives an `element-update`, then in-memory room state is updated and peers receive the socket event without waiting for the database transaction. |
| AC-9 | Edge Cases, FR-004, FR-010 | Given autosave is asked to flush an empty batch or a clean room, when the flush runs, then `documentClock` is not incremented and no records or tombstones are written. |
| AC-10 | Edge Cases, FR-010 | Given a database write fails during autosave, when the failure is handled, then the server logs the error, keeps in-memory state, and leaves the room dirty for a later retry. |
| AC-11 | FR-011, SC-005 | Every AC-1 through AC-10 persistence and autosave behavior is covered by automated tests tagged with `@covers AC-n`, and the AC coverage guard passes for this registry. |
