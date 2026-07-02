# Acceptance Criteria

AC-1: Native `.vdt.json` import into a saved document goes through `ReplaceDocumentCommand` or an equivalent authoritative domain command, without bypassing the sync room persistence path.
AC-2: Snapshot restore goes through the same replace path as import and broadcasts exactly one authoritative server truth.
AC-3: Pending commands created before replace are canceled or rejected by the room epoch change and cannot ghost-push after import or restore.
AC-4: Viewers or actors without mutate permission are rejected before parsing or applying a large replace payload.
AC-5: An element with the same id after replace but a different type/schema gets freshly rebuilt slot clocks and does not retain old slot clock metadata.
AC-6: A client receiving `ROOM_REPLACED` clears its pending queue, replaces server and optimistic state from the payload, updates `lastServerClock` and `roomEpoch`, and ignores old ACKs for requests that are no longer pending.
