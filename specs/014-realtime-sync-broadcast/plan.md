# Implementation Plan: Realtime Sync & Broadcast

**Branch**: `feat/online-room` | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-realtime-sync-broadcast/spec.md`

## Summary

P2-02 through P2-05 implement the realtime collaboration layer on top of the P2-01 room/join
infrastructure. The source code is already fully implemented as part of the `feat/online-room`
branch work. This plan documents the architecture and records what remains: adding formal
`@covers AC-n` test coverage for the 014 acceptance criteria registry.

**Implemented scope**:
- **P2-02**: `socket-client.ts` registers a mutation hook that emits `element-update` after each
  local change; the `element-update` listener calls `applyRemoteElements`. Backend broadcasts
  `element-update` to all room members except the sender.
- **P2-03**: The mutation pipeline (`createElement`, `patchElement`, `deleteElements`,
  `updateElements`) updates `elements.store` first, then fires hooks. The UI sees the change
  immediately — no round-trip wait.
- **P2-04**: `applyRemoteElements` resolves conflicts via LWW: higher `version` wins; tie →
  lower `versionNonce` wins (deterministic).
- **P2-05**: `applyRemoteElements` reads `draggingId`, `resizeSession`, `isRotating`, and
  `editingId` from `interaction.store` and skips any incoming element that is currently
  involved in a local interaction.

## Technical Context

**Language/Version**: TypeScript 6.x (frontend), TypeScript 5.8.x (backend), Node.js 22.x LTS

**Primary Dependencies**:
- Frontend: React 19, Zustand 5, socket.io-client 4.8.x, Vitest 4.x
- Backend: Express 5, socket.io 4.8.x
- Shared: `@vdt/shared` (WS_EVENTS already defined)

**Storage**: localStorage (P1, unchanged) — no server-side persistence this phase

**Testing**: Vitest 4.x with @testing-library/react

**Target Platform**: Modern browser (frontend) + Node.js 22 (backend)

**Project Type**: Web application (monorepo: frontend + backend + shared)

**Performance Goals**: Element changes delivered to all room members in < 200 ms on LAN

**Constraints**:
- No new npm dependencies
- Only `Element[]` crosses socket boundaries (Principle V)
- Conflict resolution via existing version/versionNonce scheme (Principle II)

**Scale/Scope**: ~10–50 simultaneous users per room (SPECS.md §14)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store — renderer holds no state | ✅ | `applyRemoteElements` writes only to `elements.store`; socket client has no element state |
| II | Element Versioning — `version++`, new `versionNonce`, `updatedAt` on every mutate | ✅ | Mutation pipeline already handles this; `applyRemoteElements` uses existing versioned elements |
| III | Shared Camera Transform — all layers use `camera.store.ts` | ✅ | Not touched by this feature |
| IV | ShapeUtil Strategy — no type branching in core | ✅ | Not touched by this feature |
| V | Sync Data Not Renderer — only `Element[]` crosses boundaries | ✅ | Socket payload is `{ elements: Element[] }` only |
| VI | Single Mutation Pipeline — broadcast wired via `registerMutationHook` | ✅ | `socket-client.ts` registers a hook exactly like `broadcast-channel.ts`; no direct store writes |
| VII | Committed vs Transient State — `elements.store` and `interaction.store` stay separate | ✅ | `applyRemoteElements` reads `interaction.store` (read-only for guard) and writes to `elements.store` only |

No violations. Constitution Check passes.

## Project Structure

### Documentation (this feature)

```text
specs/014-realtime-sync-broadcast/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── element-update-event.md
├── acceptance.md        # AC registry (AC-1..AC-14)
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code (no new files — implementation already complete)

```text
backend/src/
└── index.ts             ✅ complete: join-room + element-update broadcast

frontend/src/
├── store/
│   └── mutation-pipeline.ts   ✅ complete: optimistic update (store first, hooks second)
├── sync/
│   ├── apply-remote.ts        ✅ complete: LWW + reject-when-editing
│   ├── socket-client.ts       ✅ complete: join-room + element-update send/receive
│   └── __tests__/
│       ├── apply-remote.test.ts   ← needs @covers 014/AC-n tags added
│       └── socket-client.test.ts  ← needs @covers 014/AC-n tags + new tests
└── store/
    └── __tests__/
        └── mutation-pipeline.test.ts  ← new test for AC-5 (optimistic)
```

## Complexity Tracking

> No Constitution violations — table left empty.

---

## Phase 0: Research

No unknowns to resolve. All architectural decisions were made in P2-01 (spec 013) and are
already in CLAUDE.md:
- Socket.IO 4.x rooms via `socket.join(roomId)` (Finding 2 in 013 plan)
- Single `io()` instance per session (Finding 3 in 013 plan)
- `applyRemoteElements` shared between BroadcastChannel and Socket.IO (Constitution §Realtime)

**No research.md content required.** (See 013/plan.md Phase 0 for prior findings.)

---

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](data-model.md).

### Socket Event Contracts

See [contracts/element-update-event.md](contracts/element-update-event.md).

### Quickstart Validation Guide

See [quickstart.md](quickstart.md).

---

## Implementation Approach (already complete — summary for tasks.md)

### What is already built

| Item | File | Status |
|------|------|--------|
| P2-02: Mutation hook → `element-update` emit | `frontend/src/sync/socket-client.ts` | ✅ |
| P2-02: `element-update` receive → `applyRemoteElements` | `frontend/src/sync/socket-client.ts` | ✅ |
| P2-02: Server broadcast to room (excl. sender) | `backend/src/index.ts` | ✅ |
| P2-03: Store updated before hook fires | `frontend/src/store/mutation-pipeline.ts` | ✅ |
| P2-04: LWW via `version + versionNonce` | `frontend/src/sync/apply-remote.ts` | ✅ |
| P2-05: Skip remote if element is being edited | `frontend/src/sync/apply-remote.ts` | ✅ |

### What remains: test coverage for 014 ACs

| AC | Existing test (different registry) | Action needed |
|----|-------------------------------------|---------------|
| AC-1~AC-3 | `socket-client.test.ts` (013/AC-5) + `apply-remote.test.ts` (012/AC-1~AC-3) | Add `@covers 014/AC-1`, `AC-2`, `AC-3` tags |
| AC-4 | `socket-client.test.ts` (013/AC-6) | Add `@covers 014/AC-4` tag |
| AC-5 | None | New test in `mutation-pipeline.test.ts` |
| AC-6~AC-9 | `apply-remote.test.ts` (012/AC-5~AC-8) | Add `@covers 014/AC-6..AC-9` tags |
| AC-10 | None (implied by AC-6~AC-9) | New convergence test |
| AC-11~AC-13 | `apply-remote.test.ts` (012/AC-9~AC-11) | Add `@covers 014/AC-11..AC-13` tags |
| AC-14 | None | New post-drag LWW test |
