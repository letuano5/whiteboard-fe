# Acceptance Criteria

AC-1: Retry with the same `requestId` and same canonical payload replays the old ack/result without increasing the room clock.
AC-2: Retry with the same `requestId` and a different canonical payload is rejected with `DUPLICATE_REQUEST_CONFLICT`.
AC-3: Duplicate request replay does not broadcast a second change set to peers.
AC-4: After a DB commit succeeds but the ACK is lost before delivery, restart/reload can replay the ACK/result from persisted `ProcessedRequest`.
AC-5: One command that deletes three shapes and repairs five arrows increments `documentClock` exactly once.
AC-6: The server ACKs only after the DB transaction commits; DB failure leaves memory unchanged and sends no ACK/broadcast.
AC-7: If applying a committed DB change set to memory fails after commit, the room becomes unhealthy, reloads from Postgres state, rebuilds indexes, and only then resumes command handling.
AC-8: The hot path does not use `SELECT ... FOR UPDATE`; conditional clock update failure marks the room unhealthy and reloads instead of ACKing the command.
AC-9: Intermediate drag patches commit with relaxed durability; final pointerup patches and discrete commands commit with durable/default durability, and docs do not call `synchronous_commit = off` durable.
AC-10: No resendable command skips `ProcessedRequest`; only non-resendable intermediate transient patches may skip it and be reconciled by a later final patch.
