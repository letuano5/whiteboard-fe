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
- Repo roadmap ID `P5-02` maps to GSD Phase `5.2`.
- Repo roadmap ID `P5-03` maps to GSD Phase `5.3`.
- Repo roadmap ID `P5-04` maps to GSD Phase `5.4`.
- Repo roadmap ID `P5-05` maps to GSD Phase `5.5`.
- Repo roadmap ID `P5-06` maps to GSD Phase `5.6`.
- The source of truth is `docs/SPECS.md` feature sections.

- [x] **Phase 4.0: P4-00 Anonymous local board + Login to save** - Anonymous local-only board can be converted into a private saved document after login.
- [x] **Phase 4.1: P4-01 Workspace + document dashboard** - Authenticated users can list, search, create, open, rename, archive, and delete accessible saved documents.
- [x] **Phase 4.2: P4-02 Sharing, public/private access, invited users** - Owners can share saved documents by link or invite while the server enforces effective room roles.
- [x] **Phase 4.3: P4-03 Room lock + admission control** - Owners can lock saved rooms and the server enforces participant/editor capacity through effective roles.
- [x] **Phase 4.4: P4-04 Native file lifecycle: save/load `.vdt.json`** - Users can export and import the native backup format for local boards and permitted saved documents.
- [x] **Phase 5.1: P5-01 Module boundary & legacy removal** - Saved-room writes are routed through a backend sync module entrypoint instead of socket/import handlers mutating document state directly.
- [x] **Phase 5.2: P5-02 Shared sync contracts** - Shared P5 slot-level sync contracts, field mapping, command envelopes, and validation helpers are defined in `@vdt/shared`.
- [x] **Phase 5.3: P5-03 Server-authoritative SyncRoom + room actor** - Saved-room commands execute through backend hot state and per-room serialized actors.
- [x] **Phase 5.4: P5-04 Conflict resolution & validation** - Backend sync planning enforces slot-level conflict rules, delete-wins semantics, permission boundaries, reference validation, linear geometry rules, and command limits.
- [x] **Phase 5.5: P5-05 Change sets, ack/reject/rebase & broadcast** - Shared/backend/client primitives carry committed slot changes through ACKs and broadcasts.
- [x] **Phase 5.6: P5-06 Transactional persistence & idempotency** - Accepted saved-room sync commands commit atomically with DB clocks, persisted idempotency, durability policy, and unhealthy-room recovery.

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

### Phase 5.2: P5-02 Shared sync contracts

**Goal**: Define shared slot-level P5 sync contracts in `@vdt/shared` so backend and frontend use one protocol vocabulary for future server-authoritative sync.
**Depends on**: Phase 5.1
**Source**: `docs/SPECS.md` `[P5-02]`
**Canonical refs**: `docs/SPECS.md`, `specs/031-p5-02-shared-sync-contracts/acceptance.md`
**Requirements**: [P5-02-AC-1, P5-02-AC-2, P5-02-AC-3, P5-02-AC-4, P5-02-AC-5, P5-02-AC-6, P5-02-AC-7, P5-02-AC-8]
**Success Criteria** (what must be TRUE):

1. `@vdt/shared` exports the complete P5 `SyncSlot`, `SlotPatch`, `SyncCommand`, and change-set contract types.
2. Every mutable `Element` field is mapped to a slot or explicitly classified as identity, derived, non-sync, or legacy-only.
3. Shared validators reject malformed slot patches, duplicate slots, direct `order` patches, `isDeleted` patches, duplicate creates, and tombstone-window creates.
4. Create commands carry order hints and server-normalized change sets can return the final order.
5. Shared command payloads carry protocol/schema/room/request/client/epoch metadata without trusting actor identity from the payload.
6. Shared validation enforces slot clock invariants, read-precondition stale branches, P5 arrow-binding command shape, and command-level-only request/ACK semantics.
   **Plans**: 1 plan

Plans:

- [x] 05.2-01: Define shared sync contracts, validation helpers, field mapping, and AC tests.

### Phase 5.3: P5-03 Server-authoritative SyncRoom + room actor

**Goal**: Saved-room commands execute through backend `SyncRoom` hot state with per-room serialized actors and duplicate request protection.
**Depends on**: Phase 5.2
**Source**: `docs/SPECS.md` `[P5-03]`
**Canonical refs**: `docs/SPECS.md`, `specs/032-p5-03-server-authoritative-sync-room/acceptance.md`
**Requirements**: [P5-03-AC-1, P5-03-AC-2, P5-03-AC-3]
**Success Criteria** (what must be TRUE):

1. Concurrent commands for the same room commit in deterministic actor order without interleaving
   plan/apply sections.
2. Commands for different rooms run through independent actors and do not share a global
   serialization bottleneck.
3. Duplicate retries with the same actor/request ID return the first result without applying side
   effects again.
   **Plans**: 1 plan

Plans:

- [x] 05.3-01: Implement server-authoritative SyncRoom, room actor queue, idempotency, and AC tests.

### Phase 5.4: P5-04 Conflict resolution & validation

**Goal**: Backend `SyncRoom` planning applies P5 slot-level conflict semantics and validation before committing saved-room document mutations.
**Depends on**: Phase 5.3
**Source**: `docs/SPECS.md` `[P5-04]`
**Canonical refs**: `docs/SPECS.md`, `specs/033-p5-04-conflict-resolution-validation/acceptance.md`
**Requirements**: [P5-04-AC-1, P5-04-AC-2, P5-04-AC-3, P5-04-AC-4, P5-04-AC-5, P5-04-AC-6, P5-04-AC-7, P5-04-AC-8, P5-04-AC-9, P5-04-AC-10, P5-04-AC-11, P5-04-AC-12]
**Success Criteria** (what must be TRUE):

1. Different-slot stale writes merge while same-slot stale writes use latest-to-server semantics.
2. Delete wins over later patches, and viewer actors are rejected before mutation planning.
3. Invalid fields, invalid slots for element type, invalid references, and oversize commands reject before commit.
4. Linear geometry patches validate finite point data and normalize element bounding boxes server-side.
   **Plans**: 1 plan

Plans:

- [x] 05.4-01: Implement conflict resolution, validation rules, limit checks, and AC tests.

### Phase 5.5: P5-05 Change sets, ack/reject/rebase & broadcast

**Goal**: Committed sync changes are represented as canonical change sets and delivered through
ACK/reject/rebase responses and broadcasts, with client reconciliation handling pending requests,
stale clocks, gaps, and slot-only updates.
**Depends on**: Phase 5.4
**Source**: `docs/SPECS.md` `[P5-05]`
**Canonical refs**: `docs/SPECS.md`, `specs/034-p5-05-change-sets-ack-broadcast/acceptance.md`
**Requirements**: [P5-05-AC-1, P5-05-AC-2, P5-05-AC-3, P5-05-AC-4, P5-05-AC-5]
**Success Criteria** (what must be TRUE):

1. Backend committed change sets expose reason, origin, slot patch, put, delete, and clock metadata.
2. Sync ACKs distinguish `commit`, `rebase`, and `reject` and always carry protocol/schema/request/clock metadata.
3. Broadcasts carry committed change sets and may clear same-origin pending requests when ACK is missing.
4. Client reconciliation ignores stale clocks, requests diff on gaps, and applies slot-only change sets without whole-element replacement.
   **Plans**: 1 plan

Plans:

- [x] 05.5-01: Implement change sets, ACK/reject/rebase, broadcast primitives, and AC tests.

### Phase 5.6: P5-06 Transactional persistence & idempotency

**Goal**: Accepted saved-room sync commands commit through one DB transaction that advances
`Room.documentClock` exactly once, persists touched records/tombstones/slot clocks and
`ProcessedRequest`, replays duplicate requests from durable storage, and protects memory state
when persistence or post-commit apply fails.
**Depends on**: Phase 5.5
**Source**: `docs/SPECS.md` `[P5-06]`
**Canonical refs**: `docs/SPECS.md`, `specs/035-p5-06-transactional-persistence-idempotency/acceptance.md`
**Requirements**: [P5-06-AC-1, P5-06-AC-2, P5-06-AC-3, P5-06-AC-4, P5-06-AC-5, P5-06-AC-6, P5-06-AC-7, P5-06-AC-8, P5-06-AC-9, P5-06-AC-10]
**Success Criteria** (what must be TRUE):

1. Duplicate resendable commands replay persisted results without re-mutating state or broadcasting.
2. Conflicting duplicate request IDs reject before domain validation and before mutation.
3. Accepted commands persist records/tombstones/slot clocks and `ProcessedRequest` in one transaction
   with one conditional `documentClock` advance.
4. DB failures, conditional clock conflicts, and post-commit memory apply failures do not leave the
   hot room acknowledging divergent state.
5. Intermediate transient drag patches are the only relaxed/non-resendable path; final and discrete
   commands stay durable/resendable.
   **Plans**: 3 plans

Plans:

- [x] 05.6-01: Add P5-06 schema, shared delivery hints, and recovery load state.
- [x] 05.6-02: Add SyncRoom transactional persistence, persisted idempotency, invariants, and recovery.
- [x] 05.6-03: Enforce socket ACK safeguards and close P5-06 verification.

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
| 5.2. P5-02 Shared sync contracts                 | 1/1            | Complete | 2026-07-02 |
| 5.3. P5-03 Server-authoritative SyncRoom         | 1/1            | Complete | 2026-07-02 |
| 5.4. P5-04 Conflict resolution & validation      | 1/1            | Complete | 2026-07-02 |
| 5.5. P5-05 Change sets + ACK/broadcast           | 1/1            | Complete | 2026-07-02 |
| 5.6. P5-06 Transactional persistence             | 3/3            | Complete | 2026-07-02 |
