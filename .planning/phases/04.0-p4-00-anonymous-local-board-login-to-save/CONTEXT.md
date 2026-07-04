---
phase: "04.0"
name: "P4-00 Anonymous local board + Login to save"
created: 2026-06-30
source: "docs/SPECS.md [P4-00]"
---

# Phase 4.0: P4-00 Anonymous local board + Login to save - Context

## Scope Anchor

Implement only `docs/SPECS.md` `[P4-00]`: anonymous local-only board, `Login to save`, and
conversion of the current local board into a persisted saved document after authenticated
confirmation.

## Locked Decisions

- GSD mapping: repo feature ID `P4-00` maps to GSD Phase `4.0`.
- Root path without `?room=` is local-only board mode for this feature.
- Saved documents continue to use the established query-string route `/?room=<uuid>`.
- Local-only board uses the existing browser-local primitives: `localStorage` and
  `BroadcastChannel`.
- Local-only board must not initialize Socket.IO or backend autosave.
- `Login to save` is implemented as an in-board CTA/modal so the user returns to the same local
  canvas after login.
- Confirmed save posts the current local scene to an authenticated backend endpoint. The backend
  creates a new room, creates owner membership, persists imported elements via the existing room
  persistence path, and returns the new room id.
- Canceling confirmation keeps the board local-only.

## Non-Goals

- Workspace dashboard (`P4-01`).
- Link/public sharing, invited users, or private room access enforcement beyond owner creation
  (`P4-02`).
- Room lock/admission control (`P4-03`).
- Native `.vdt.json` import/export (`P4-04`) and cross-platform import/export (`P4-05`).
- Asset metadata/storage adapter (`P4-06`) and snapshots/version history (`P4-07`).

## Acceptance Mapping

- `specs/025-anonymous-local-board-login-save/acceptance.md` is the append-only AC registry.
- Every new acceptance test for this phase must include `@covers AC-n`.

## Known Risk

- Existing room/auth work is already modified in the working tree before this workflow. Source
  edits must preserve those changes and avoid broad refactors.
