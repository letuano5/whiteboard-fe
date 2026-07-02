# Context: Phase 5.10 P5-10 Export adapters use materialized server truth

## Source

- Canonical scope: `docs/SPECS.md` `[P5-10]`.
- Acceptance registry: `specs/039-p5-10-export-server-truth/acceptance.md`.
- GSD mapping: repo roadmap ID `P5-10` maps to GSD Phase `5.10`.
- Depends on: P5-09 replace-document server truth, P5-07 materialized load/reconnect state, and P5-06 transactional persistence.

## Locked Decisions

- Local-board export may still use the local frontend store because local boards have no server truth.
- Saved-document export must call a backend endpoint that materializes the current saved document from the hot `SyncRoom` when available, or loads the room through the same repository-backed sync room path.
- Export is read-only: it must not execute a sync command, broadcast, write records, write processed requests, or increment `documentClock`.
- Native import/export normalization lives in shared/native-file helpers so frontend parsing and backend import share the same object acceptance rules and reporting shape.
- Unsupported element objects are skipped with reasons when a structurally valid native file is parsed. Invalid top-level file structure, room metadata, camera, or asset metadata remains a hard validation error.
- Saved import only executes replace when the accepted normalized document is safe to apply; malformed/skipped element objects are reported in the response so callers can surface them.

## Non-goals

- No binary asset upload, storage, reference counting, or garbage collection.
- No cross-platform format UI beyond the shared native normalizer/reporting primitive.
- No full P5-11 optimistic command migration.
