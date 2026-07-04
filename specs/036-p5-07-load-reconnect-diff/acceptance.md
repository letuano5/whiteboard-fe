# Acceptance Criteria

AC-1: `ROOM_SNAPSHOT` hydrates full server state with `protocolVersion`, `schemaVersion`, `roomId`, `serverClock`, `roomEpoch`, `elements`, `slotClocks`, and optional `processedRequestHistoryStartsAtClock`.
AC-2: `ROOM_DIFF` from a valid `lastServerClock` returns only changed records, deleted tombstones, slot clocks newer than `lastServerClock`, `fromClock`, `toClock`, `serverClock`, `roomEpoch`, `hasMore`, and optional `nextFromClock`.
AC-3: Reconnect requests send `lastServerClock`, `roomEpoch`, and `pendingRequestIds`; the server response includes `kind: 'snapshot' | 'diff'` plus `PendingRequestStatus[]`.
AC-4: Pending request statuses distinguish `processed`, `unknown`, `conflict`, and `expired`; processed pending requests can clear/replay ACKs, while conflict/expired are not resent blindly.
AC-5: Diff reads use a consistent target clock and never cross a replace boundary; if `lastServerClock < roomEpoch` or history is too old, the response is a wipe-all snapshot.
AC-6: Diff slot clocks are built by coarse filtering records/tombstones in `(lastServerClock, targetClock]`, then including only slots whose stored clock is greater than `lastServerClock`.
AC-7: The client updates `lastServerClock` only after fully applying snapshot/diff/change set and keeps `knownSlotClock[elementId][slot]` rather than treating max slot clocks as full document clocks.
AC-8: The client applies `ROOM_DIFF` slot-aware from `changed` plus `slotClocks`, without needing `originRequestIds`, and copies only slots newer than the previous base clock for existing elements.
