# Roadmap: Realtime Collaborative Tactical Whiteboard

## Overview

This GSD roadmap is a narrow operational mapping for the active requested feature. The full
project roadmap, phase order, and product scope remain canonical in `docs/SPECS.md`.

## Phases

**Phase Numbering:**

- Repo roadmap ID `P4-00` maps to GSD Phase `4.0`.
- Repo roadmap ID `P4-01` maps to GSD Phase `4.1`.
- The source of truth is `docs/SPECS.md` section `[P4-00]`.

- [x] **Phase 4.0: P4-00 Anonymous local board + Login to save** - Anonymous local-only board can be converted into a private saved document after login.
- [x] **Phase 4.1: P4-01 Workspace + document dashboard** - Authenticated users can list, search, create, open, rename, archive, and delete accessible saved documents.

## Phase Details

### Phase 4.0: P4-00 Anonymous local board + Login to save

**Goal**: Anonymous users can work locally without creating DB rooms, then log in and confirm saving the current local board as a persisted document owned by that user.
**Depends on**: Phase 3
**Source**: `docs/SPECS.md` `[P4-00]`
**Canonical refs**: `docs/SPECS.md`, `specs/025-anonymous-local-board-login-save/acceptance.md`
**Requirements**: [P4-00-AC-1, P4-00-AC-2, P4-00-AC-3, P4-00-AC-4, P4-00-AC-5, P4-00-AC-6, P4-00-AC-7, P4-00-AC-8, P4-00-AC-9]
**Success Criteria** (what must be TRUE):

1. Anonymous root-path board loads and uses browser persistence without joining a Socket.IO room.
2. Local board changes persist after reload and sync to another tab through BroadcastChannel.
3. Local board shows `Login to save`; saved rooms opened by `/?room=<uuid>` do not.
4. Authenticated save confirmation creates a new persisted room with owner membership and imports current elements.
5. Save failures preserve local board content and show an actionable error.
   **Plans**: 1 plan

Plans:

- [x] 04.0-01: Implement local board mode, login-to-save UI, save endpoint, and AC tests.

### Phase 4.1: P4-01 Workspace + document dashboard

**Goal**: Authenticated users can manage saved documents from a dashboard while anonymous users remain on the local-board/login path.
**Depends on**: Phase 4.0
**Source**: `docs/SPECS.md` `[P4-01]`
**Canonical refs**: `docs/SPECS.md`, `specs/026-workspace-document-dashboard/acceptance.md`
**Requirements**: [P4-01-AC-1, P4-01-AC-2, P4-01-AC-3, P4-01-AC-4, P4-01-AC-5, P4-01-AC-6, P4-01-AC-7]
**Success Criteria** (what must be TRUE):

1. Anonymous dashboard access does not expose document data and offers login/local-board actions.
2. Authenticated dashboard lists only owned or member-accessible rooms, split into Owned, Shared with me, and Recent.
3. Search/filter can narrow by text, shared/locked status, and archived visibility without leaking private rooms.
4. Creating a new dashboard document creates a private owned saved room and navigates to `/?room=<uuid>`.
5. Backend rejects rename/archive/delete for non-owner/non-admin actors and records document open timestamps for Recent.
   **Plans**: 1 plan

Plans:

- [x] 04.1-01: Implement document dashboard API, dashboard UI route, metadata schema, and AC tests.

## Progress

**Execution Order:**
Follow `docs/SPECS.md`; this bootstrap tracks only active Phase 4.0.

| Phase                                            | Plans Complete | Status   | Completed  |
| ------------------------------------------------ | -------------- | -------- | ---------- |
| 4.0. P4-00 Anonymous local board + Login to save | 1/1            | Complete | 2026-06-30 |
| 4.1. P4-01 Workspace + document dashboard        | 1/1            | Complete | 2026-06-30 |
