# Acceptance Criteria

AC-1: Native export for a saved document fetches a materialized server snapshot from the SyncRoom/repository path and does not build the export from stale frontend element state.
AC-2: Export immediately after committed concurrent edits reflects the latest committed server state and does not mutate the document or advance documentClock.
AC-3: Native import/export round-trip preserves element types, styles, zIndex/order, angle, group/frame metadata, camera, room metadata, and existing asset references.
AC-4: Unsupported or malformed element objects are skipped with an import/export report containing imported/skipped counts and reasons, without applying a half-mutated saved document.
