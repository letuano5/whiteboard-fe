# Realtime Collaborative Tactical Whiteboard

## What This Is

Realtime Collaborative Tactical Whiteboard is a web app for drawing, arranging, and
collaborating on an infinite tactical canvas. The canonical roadmap and product scope live in
`docs/SPECS.md`; this GSD context operationalizes only the active feature slice.

## Core Value

Users can create tactical whiteboards without losing work, then collaborate or persist documents
when the workflow calls for it.

## Requirements

### Validated

- Prior P0-P3 work exists in code and `specs/` artifacts, including SVG whiteboard editing,
  local storage primitives, Socket.IO rooms, PostgreSQL persistence, auth, and reconnect diff.

### Active

- [ ] Anonymous users can use a local-only board without creating persisted database rooms.
- [ ] Authenticated users can convert local board content into a saved document.
- [ ] Saved rooms remain accessed through the existing `/?room=<uuid>` query-string pattern.

### Out of Scope

- Public/link sharing, invited users, admission control, file import/export, asset storage, and
  version history are deferred to later P4 feature IDs in `docs/SPECS.md`.
- Anonymous network realtime for saved rooms is deferred to P4-02.

## Context

- Monorepo managed by pnpm workspaces: `frontend/`, `backend/`, and `packages/shared/`.
- Shared frontend/backend contracts are owned by `packages/shared/src/index.ts`.
- URL routing uses native query string `/?room=<uuid>` and no router library.
- `docs/SPECS.md` is the source of truth for scope and phase order.

## Constraints

- **Tech stack**: React/Vite/Zustand frontend and Express/Socket.IO/Prisma backend.
- **Persistence**: Local board uses browser `localStorage` + `BroadcastChannel`; saved documents
  use backend room persistence.
- **Safety**: Do not run `git add`, `git commit`, `git push`, or ship commands unless explicitly
  asked.

## Key Decisions

| Decision | Rationale | Outcome |
| --- | --- | --- |
| Use `/?room=<uuid>` only for saved documents | Existing architectural decision in `AGENTS.md` | Pending |
| Root path without `room` is the local-only board surface for P4-00 | Prevents anonymous local work from accidentally joining/creating a DB room | Pending |

---
*Last updated: 2026-06-30 after GSD bootstrap for P4-00*
