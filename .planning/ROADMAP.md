# Roadmap: Realtime Collaborative Tactical Whiteboard

## Overview

This GSD roadmap is a narrow operational mapping for the active requested feature. The full
project roadmap, phase order, and product scope remain canonical in `docs/SPECS.md`.

## Phases

**Phase Numbering:**

- Repo roadmap ID `P4-00` maps to GSD Phase `4.0`.
- Repo roadmap ID `P4-01` maps to GSD Phase `4.1`.
- Repo roadmap ID `P4-02` maps to GSD Phase `4.2`.
- Repo roadmap ID `P4-03` maps to GSD Phase `4.3`.
- Repo roadmap ID `P4-04` maps to GSD Phase `4.4`.
- Repo roadmap ID `P5-01` maps to GSD Phase `5.1`.
- The source of truth is `docs/SPECS.md` feature sections.

- [x] **Phase 4.0: P4-00 Anonymous local board + Login to save** - Anonymous local-only board can be converted into a private saved document after login.
- [x] **Phase 4.1: P4-01 Workspace + document dashboard** - Authenticated users can list, search, create, open, rename, archive, and delete accessible saved documents.
- [x] **Phase 4.2: P4-02 Sharing, public/private access, invited users** - Owners can share saved documents by link or invite while the server enforces effective room roles.
- [x] **Phase 4.3: P4-03 Room lock + admission control** - Owners can lock saved rooms and the server enforces participant/editor capacity through effective roles.
- [x] **Phase 4.4: P4-04 Native file lifecycle: save/load `.vdt.json`** - Users can export and import the native backup format for local boards and permitted saved documents.
- [x] **Phase 5.1: P5-01 Module boundary & legacy removal** - Saved-room writes are routed through a backend sync module entrypoint instead of socket/import handlers mutating document state directly.

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

### Phase 4.2: P4-02 Sharing, public/private access, invited users

**Goal**: Saved document owners can manage access by invite or share link while server-side join and mutation paths enforce `baseRole` and `effectiveRole`.
**Depends on**: Phase 4.1
**Source**: `docs/SPECS.md` `[P4-02]`
**Canonical refs**: `docs/SPECS.md`, `specs/027-sharing-access-invites/acceptance.md`
**Requirements**: [P4-02-AC-1, P4-02-AC-2, P4-02-AC-3, P4-02-AC-4, P4-02-AC-5, P4-02-AC-6, P4-02-AC-7, P4-02-AC-8, P4-02-AC-9]
**Success Criteria** (what must be TRUE):

1. Owners can create, change, copy, and revoke room share links and manage explicit invited users.
2. Explicit membership or claimed invitation wins over link-derived access.
3. Private rooms reject users without owner/member/invite access.
4. Link view/edit modes assign the expected effective role and respect lock/capacity downgrades.
5. Frontend edit and access-management controls reflect effective role while backend enforcement remains authoritative.
   **Plans**: 1 plan

Plans:

- [x] 04.2-01: Implement sharing access modes, invitation management, effective roles, UI modal, and AC tests.

### Phase 4.3: P4-03 Room lock + admission control

**Goal**: Saved room owners can lock/unlock collaboration while admission control enforces
participant and editor limits through `baseRole` and `effectiveRole`.
**Depends on**: Phase 4.2
**Source**: `docs/SPECS.md` `[P4-03]`
**Canonical refs**: `docs/SPECS.md`, `specs/028-room-lock-admission-control/acceptance.md`
**Requirements**: [P4-03-AC-1, P4-03-AC-2, P4-03-AC-3, P4-03-AC-4, P4-03-AC-5, P4-03-AC-6]
**Success Criteria** (what must be TRUE):

1. Locked saved rooms continue to stream updates to editors/viewers while rejecting their
   mutation attempts.

2. Owners/admins can lock/unlock rooms and retain mutation rights while locked.
3. Participant capacity blocks additional joins with an explicit admission error.
4. Editor capacity downgrades otherwise eligible editors to viewer on join.
5. Presence/online user metadata includes effective roles; realtime auto-promotion after leave is
   not required in this phase.
   **Plans**: 1 plan

Plans:

- [x] 04.3-01: Implement room lock controls, admission limits, effective-role presence, and AC tests.

### Phase 4.4: P4-04 Native file lifecycle: save/load `.vdt.json`

**Goal**: Local boards and saved documents can export native `.vdt.json` files, validate and import them with explicit overwrite confirmation, and route persisted imports through server-side permission and mutation paths.
**Depends on**: Phase 4.3
**Source**: `docs/SPECS.md` `[P4-04]`
**Canonical refs**: `docs/SPECS.md`, `specs/029-native-file-lifecycle/acceptance.md`
**Requirements**: [P4-04-AC-1, P4-04-AC-2, P4-04-AC-3, P4-04-AC-4, P4-04-AC-5]
**Success Criteria** (what must be TRUE):

1. Exported `.vdt.json` includes schema version, room metadata, camera, elements, and optional asset metadata without dropping current element fields.
2. Import validates schema and reports invalid/malformed files without crashing.
3. Import into a non-empty local or saved board requires explicit user confirmation before replace or merge.
4. Anonymous local import updates only local browser state and does not create a database room.
5. Saved-room import requires editor/owner effective access and writes via the persisted room mutation path.
   **Plans**: 1 plan

Plans:

- [x] 04.4-01: Implement native file export/import contract, local/saved import flows, UI, and AC tests.

### Phase 5.1: P5-01 Module boundary & legacy removal

**Goal**: Establish the backend sync module boundary and remove saved-room document mutation logic from legacy socket/import handlers.
**Depends on**: Phase 4.4
**Source**: `docs/SPECS.md` `[P5-01]`
**Canonical refs**: `docs/SPECS.md`, `specs/030-p5-01-module-boundary-legacy-removal/acceptance.md`
**Requirements**: [P5-01-AC-1, P5-01-AC-2, P5-01-AC-3]
**Success Criteria** (what must be TRUE):

1. Saved-room realtime element updates enter the backend sync module through a single entrypoint.
2. Saved-room native-file import writes enter the same backend sync module entrypoint.
3. Legacy whole-element sync remains documented as a compatibility adapter, not the long-term saved-room authoritative model.
   **Plans**: 1 plan

Plans:

- [x] 05.1-01: Create backend sync module boundary, route legacy adapters through it, and cover AC tests.

## Progress

**Execution Order:**
Follow `docs/SPECS.md`; this bootstrap tracks active Phase 4 feature slices.

| Phase                                            | Plans Complete | Status   | Completed  |
| ------------------------------------------------ | -------------- | -------- | ---------- |
| 4.0. P4-00 Anonymous local board + Login to save | 1/1            | Complete | 2026-06-30 |
| 4.1. P4-01 Workspace + document dashboard        | 1/1            | Complete | 2026-06-30 |
| 4.2. P4-02 Sharing, public/private access        | 1/1            | Complete | 2026-06-30 |
| 4.3. P4-03 Room lock + admission control         | 1/1            | Complete | 2026-07-01 |
| 4.4. P4-04 Native file lifecycle                 | 1/1            | Complete | 2026-07-01 |
| 5.1. P5-01 Module boundary & legacy removal      | 1/1            | Complete | 2026-07-02 |
