# Acceptance Criteria

AC-1: Saved-room UI lists server snapshots with timestamp, reason, createdBy, document clock, and room epoch metadata.
AC-2: Owner restore requires an explicit confirmation before replacing the whole saved document state.
AC-3: Restoring a snapshot executes through the existing ReplaceDocumentCommand/SyncRoom path and broadcasts ROOM_REPLACED as the authoritative server truth.
AC-4: ROOM_REPLACED clears pending legacy queue state, pending sync commands, in-flight requests, buffered sync events, and local undo/redo history.
AC-5: The server creates interval snapshots automatically after committed changes when at least 30 seconds have elapsed and the document clock advanced.
AC-6: The server stores a restore_safety snapshot before restore and an import_safety snapshot before saved-room import.
AC-7: Non-owner users, including editors and viewers, are rejected when attempting to restore a snapshot.
AC-8: Snapshot restore does not mutate Record or Tombstone directly outside the SyncRoom persistence path.
