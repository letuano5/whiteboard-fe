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
- Repo roadmap ID `P4-07` maps to GSD Phase `4.7`.
- Repo roadmap ID `P5-01` maps to GSD Phase `5.1`.
- Repo roadmap ID `P5-02` maps to GSD Phase `5.2`.
- Repo roadmap ID `P5-03` maps to GSD Phase `5.3`.
- Repo roadmap ID `P5-04` maps to GSD Phase `5.4`.
- Repo roadmap ID `P5-05` maps to GSD Phase `5.5`.
- Repo roadmap ID `P5-06` maps to GSD Phase `5.6`.
- Repo roadmap ID `P5-07` maps to GSD Phase `5.7`.
- Repo roadmap ID `P5-08` maps to GSD Phase `5.8`.
- Repo roadmap ID `P5-09` maps to GSD Phase `5.9`.
- Repo roadmap ID `P5-10` maps to GSD Phase `5.10`.
- Repo roadmap ID `P5-11` maps to GSD Phase `5.11`.
- Repo roadmap ID `P2.5-01` maps to GSD Phase `2.51`.
- Repo roadmap ID `P2.5-07` maps to GSD Phase `2.57`.
- Repo roadmap ID `P3C-00` maps to GSD Phase `3.30`.
- Repo roadmap ID `P3C-01` maps to GSD Phase `3.31`.
- Repo roadmap ID `P3C-02` maps to GSD Phase `3.32`.
- Repo roadmap ID `P3C-03` maps to GSD Phase `3.33`.
- Repo roadmap ID `P3C-04` maps to GSD Phase `3.34`.
- The source of truth is `docs/SPECS.md` feature sections.

- [x] **Phase 2.51: P2.5-01 Image / background map** - Users can insert images from URL or upload, render them in the SVG layer, move/resize them, and place them as background maps.
- [x] **Phase 3.30: P3C-00 Re-render isolation** - Draft point updates are isolated from the main whiteboard and committed shape rendering before SVG ink tools are added.
- [x] **Phase 3.31: P3C-01 SVG ink layer** - Freehand and highlighter elements render through the existing shared-camera SVG layer without introducing a Canvas render path.
- [x] **Phase 3.32: P3C-02 Freehand** - Users can draw SVG freehand strokes that simplify points, commit through the shared mutation pipeline, and split automatically at the per-shape point cap.
- [x] **Phase 3.33: P3C-03 Highlighter** - Users can draw SVG highlighter strokes with fixed semi-transparent, wider styling through the shared freehand ink pipeline.
- [x] **Phase 3.34: P3C-04 Eraser** - Users can drag an eraser through existing shapes, reusing shape hit-testing to soft-delete whole elements through the shared mutation pipeline.
- [x] **Phase 4.0: P4-00 Anonymous local board + Login to save** - Anonymous local-only board can be converted into a private saved document after login.
- [x] **Phase 4.1: P4-01 Workspace + document dashboard** - Authenticated users can list, search, create, open, rename, archive, and delete accessible saved documents.
- [x] **Phase 4.2: P4-02 Sharing, public/private access, invited users** - Owners can share saved documents by link or invite while the server enforces effective room roles.
- [x] **Phase 4.3: P4-03 Room lock + admission control** - Owners can lock saved rooms and the server enforces participant/editor capacity through effective roles.
- [x] **Phase 4.4: P4-04 Native file lifecycle: save/load `.vdt.json`** - Users can export and import the native backup format for local boards and permitted saved documents.
- [x] **Phase 4.7: P4-07 Version history (snapshot) + owner restore** - Saved documents keep automatic/safety server snapshots and owners can restore snapshots through the authoritative replace path.
- [x] **Phase 5.1: P5-01 Module boundary & legacy removal** - Saved-room writes are routed through a backend sync module entrypoint instead of socket/import handlers mutating document state directly.
- [x] **Phase 5.2: P5-02 Shared sync contracts** - Shared P5 slot-level sync contracts, field mapping, command envelopes, and validation helpers are defined in `@vdt/shared`.
- [x] **Phase 5.3: P5-03 Server-authoritative SyncRoom + room actor** - Saved-room commands execute through backend hot state and per-room serialized actors.
- [x] **Phase 5.4: P5-04 Conflict resolution & validation** - Backend sync planning enforces slot-level conflict rules, delete-wins semantics, permission boundaries, reference validation, linear geometry rules, and command limits.
- [x] **Phase 5.5: P5-05 Change sets, ack/reject/rebase & broadcast** - Shared/backend/client primitives carry committed slot changes through ACKs and broadcasts.
- [x] **Phase 5.6: P5-06 Transactional persistence & idempotency** - Accepted saved-room sync commands commit atomically with DB clocks, persisted idempotency, durability policy, and unhealthy-room recovery.
- [x] **Phase 5.7: P5-07 Load, reconnect & diff** - Saved-room load and reconnect hydrate/apply server-authoritative snapshot/diff payloads with room epoch, slot clocks, pending request statuses, and wipe-all fallback.
- [x] **Phase 5.8: P5-08 Delete, tombstone & binding repair** - Saved-room deletes write tombstones and repair arrow bindings/geometry in the same authoritative change set.
- [x] **Phase 5.9: P5-09 Replace document for import/restore** - Saved-room import/restore replaces the document through the authoritative sync room path, bumps room epoch, and broadcasts one server truth.
- [x] **Phase 5.10: P5-10 Export adapters use materialized server truth** - Saved-room native export reads a materialized server snapshot and shared import/export normalization reports unsupported objects without partial mutation.
- [x] **Phase 5.11: P5-11 Frontend reconciliation** - Saved-room frontend mutations use bounded P5 command queues, slot-aware reconciliation, reconnect-safe pending replay, and ephemeral presence/draft preview.
- [x] **Phase 2.57: P2.5-07 Merge items + bind text vào container** - Users can merge multiple elements into a group via `groupId`, and merging exactly one text with one container shape binds the text as a centered, wrapping, container-following label.

## Phase Details

### Phase 2.51: P2.5-01 Image / background map

**Goal**: Users can insert tactical map images from URL or local upload, render them through the
existing SVG element layer, and place them below other shapes as a background.
**Depends on**: Phase 2
**Source**: `docs/SPECS.md` `[P2.5-01]`
**Canonical refs**: `docs/SPECS.md`, `specs/046-image-background/acceptance.md`
**Requirements**: [AC-1, AC-2, AC-3, AC-4]
**Success Criteria** (what must be TRUE):

1. URL insertion creates a committed `image` element with `props.src` set to the URL.
2. File upload insertion creates a committed `image` element with a base64 data URL.
3. Image elements render as SVG `<image>` nodes through the shared-camera element layer.
4. Inserted images can be selected, moved, resized, and sent behind existing visible elements.
   **Plans**: 1 plan

Plans:

- [x] 02.51-01: Add SVG image shape rendering, toolbar insertion, background z-order, and AC tests.

### Phase 3.30: P3C-00 Re-render isolation

**Goal**: Isolate point-heavy draft rendering so future freehand/highlighter pointer samples do not re-render `Whiteboard.tsx` or unchanged committed shapes.
**Depends on**: Phase 3B
**Source**: `docs/SPECS.md` `[P3C-00]`
**Canonical refs**: `docs/SPECS.md`, `specs/041-p3c-00-rerender-isolation/acceptance.md`
**Requirements**: [P3C-00-AC-1, P3C-00-AC-2, P3C-00-AC-3]
**Success Criteria** (what must be TRUE):

1. `Whiteboard.tsx` no longer subscribes directly to draft element state.
2. Draft rendering is handled by child SVG-layer components that subscribe to draft slices.
3. Memoized committed element rendering prevents a draft point update from re-rendering unchanged committed shapes.
4. Existing move/resize draft hiding and selection overlay behavior remains intact.
   **Plans**: 1 plan

Plans:

- [x] 03.30-01: Isolate draft subscriptions, memoize committed element rendering, and cover P3C-00 AC tests.

### Phase 3.31: P3C-01 SVG ink layer

**Goal**: Freehand and highlighter element types render in the existing SVG whiteboard layer using
the shared camera transform and no separate Canvas renderer.
**Depends on**: Phase 3.30
**Source**: `docs/SPECS.md` `[P3C-01]`
**Canonical refs**: `docs/SPECS.md`, `specs/042-p3c-01-svg-ink-layer/acceptance.md`
**Requirements**: [P3C-01-AC-1, P3C-01-AC-2]
**Success Criteria** (what must be TRUE):

1. Freehand elements are routed through the committed SVG element layer.
2. Highlighter elements are routed through the same SVG element layer.
3. Ink path coordinates remain world-space element geometry under the existing camera-transformed
   SVG group.
4. No Canvas/2D context render path is introduced for freehand or highlighter.
   **Plans**: 1 plan

Plans:

- [x] 03.31-01: Add SVG ink shape routing/rendering and AC tests.

### Phase 3.32: P3C-02 Freehand

**Goal**: Add a freehand drawing tool that stores point-based SVG ink elements through the existing
mutation pipeline, simplifies raw samples, and keeps each committed stroke under the point cap.
**Depends on**: Phase 3.31
**Source**: `docs/SPECS.md` `[P3C-02]`
**Canonical refs**: `docs/SPECS.md`, `specs/043-p3c-02-freehand/acceptance.md`
**Requirements**: [P3C-02-AC-1, P3C-02-AC-2, P3C-02-AC-3]
**Success Criteria** (what must be TRUE):

1. Freehand pointer input creates committed `freehand` elements with `props.points`.
2. Committed freehand elements move/delete through the existing element mutation pipeline.
3. Raw pointer samples are simplified before SVG path generation.
4. Drawing beyond the per-shape point cap auto-commits the current stroke and continues in a new
   `freehand` element.
   **Plans**: 1 plan

Plans:

- [x] 03.32-01: Implement freehand drawing, point simplification, point-cap stroke splitting, and AC tests.

### Phase 3.33: P3C-03 Highlighter

**Goal**: Add a highlighter drawing tool that stores point-based SVG ink elements through the
existing mutation pipeline, with fixed semi-transparent wider styling and the same point
simplification/cap pipeline used by freehand.
**Depends on**: Phase 3.32
**Source**: `docs/SPECS.md` `[P3C-03]`
**Canonical refs**: `docs/SPECS.md`, `specs/047-p3c-03-highlighter/acceptance.md`
**Requirements**: [P3C-03-AC-1, P3C-03-AC-2, P3C-03-AC-3, P3C-03-AC-4]
**Success Criteria** (what must be TRUE):

1. Highlighter pointer input creates committed `highlighter` elements with `props.points` through
   the existing mutation pipeline and SVG ink layer.
2. Highlighter elements use fixed semi-transparent opacity and a wider stroke width than freehand.
3. Raw pointer samples are simplified and capped using the same helper pipeline as freehand.
4. The toolbar exposes highlighter as an editing tool and tool switches clear highlighter drafts.
   **Plans**: 1 plan

Plans:

- [x] 03.33-01: Implement highlighter tool routing, styling defaults, shared ink point pipeline,
      toolbar access, and AC tests.

### Phase 3.34: P3C-04 Eraser

**Goal**: Add an eraser tool that deletes whole shapes while dragging through them, using the
existing shape hit-test utilities and shared element mutation pipeline.
**Depends on**: Phase 3.32
**Source**: `docs/SPECS.md` `[P3C-04]`
**Canonical refs**: `docs/SPECS.md`, `specs/044-p3c-04-eraser/acceptance.md`
**Requirements**: [P3C-04-AC-1, P3C-04-AC-2, P3C-04-AC-3, P3C-04-AC-4, P3C-04-AC-5]
**Success Criteria** (what must be TRUE):

1. Selecting the eraser tool and dragging through visible shapes soft-deletes them with
   `isDeleted = true`.
2. Eraser deletes flow through the same mutation pipeline as other deletes, so existing realtime
   sync hooks can broadcast the deletion.
3. Pointer movement is evaluated as a line-segment sweep between consecutive pointer samples and
   reuses registered shape hit-test utilities instead of introducing a separate hit-test system.
4. Eraser deletes whole elements only; it does not split freehand/highlighter strokes into pieces.
5. Eraser deletes are undoable through the existing local undo history.
   **Plans**: 1 plan

Plans:

- [x] 03.34-01: Implement eraser tool routing, segment-sweep hit testing, whole-element soft delete,
      and AC tests.

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

### Phase 4.7: P4-07 Version history (snapshot) + owner restore

**Goal**: Saved documents keep automatic interval snapshots and import/restore safety snapshots,
and owners can restore snapshots through the existing authoritative replace path.
**Depends on**: Phase 4.4, Phase 5.9
**Source**: `docs/SPECS.md` `[P4-07]`
**Canonical refs**: `docs/SPECS.md`, `specs/045-p4-07-version-history/acceptance.md`
**Requirements**: [P4-07-AC-1, P4-07-AC-2, P4-07-AC-3, P4-07-AC-4, P4-07-AC-5, P4-07-AC-6, P4-07-AC-7, P4-07-AC-8]
**Success Criteria** (what must be TRUE):

1. Saved-room users can list snapshot metadata from the server.
2. Owners can restore a snapshot only after explicit confirmation.
3. Restore runs through `ReplaceDocumentCommand`/`SyncRoom` and broadcasts `ROOM_REPLACED`.
4. Import and restore write safety snapshots before replacing the document.
5. Backend committed changes create interval snapshots after the 30s/clock threshold.
6. Non-owner restore attempts are rejected server-side.
7. `ROOM_REPLACED` clears pending client work and undo/redo history.
   **Plans**: 1 plan

Plans:

- [x] 04.7-01: Implement snapshot persistence, interval/safety capture, owner restore API, history UI, and AC tests.

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

### Phase 5.7: P5-07 Load, reconnect & diff

**Goal**: Saved-room load and reconnect use P5 snapshot/diff contracts with `documentClock`,
`roomEpoch`, slot clocks, pending request statuses, and safe wipe-all fallback when diff history
is unavailable or crosses a replace boundary.
**Depends on**: Phase 5.6
**Source**: `docs/SPECS.md` `[P5-07]`
**Canonical refs**: `docs/SPECS.md`, `specs/036-p5-07-load-reconnect-diff/acceptance.md`
**Requirements**: [P5-07-AC-1, P5-07-AC-2, P5-07-AC-3, P5-07-AC-4, P5-07-AC-5, P5-07-AC-6, P5-07-AC-7, P5-07-AC-8]
**Success Criteria** (what must be TRUE):

1. `ROOM_SNAPSHOT` and `ROOM_DIFF` expose the P5 protocol/schema, room epoch, server clock, and
   relevant slot clocks.
2. Reconnect requests carry last applied server clock, room epoch, and pending request IDs, and
   responses include pending request statuses derived from persisted idempotency.
3. Diff reads are clock-bounded and slot-aware; stale history or replace-boundary gaps return a
   wipe-all snapshot instead of an unsafe diff.
4. Client reconciliation applies snapshot/diff only after full payload materialization, updates
   `lastServerClock` afterward, and uses known slot clocks to copy only fresher slots.
   **Plans**: 1 plan

Plans:

- [x] 05.7-01: Implement P5 snapshot/diff contracts, reconnect statuses, slot-aware client apply, and AC tests.

### Phase 5.8: P5-08 Delete, tombstone & binding repair

**Goal**: Saved-room delete and binding mutations keep tombstones, arrow bindings, and arrow geometry consistent through the server-authoritative sync path.
**Depends on**: Phase 5.7
**Source**: `docs/SPECS.md` `[P5-08]`
**Canonical refs**: `docs/SPECS.md`, `specs/037-p5-08-delete-tombstone-binding-repair/acceptance.md`
**Requirements**: [P5-08-AC-1, P5-08-AC-2, P5-08-AC-3, P5-08-AC-4, P5-08-AC-5, P5-08-AC-6, P5-08-AC-7, P5-08-AC-8]
**Success Criteria** (what must be TRUE):

1. Deleting an active bound target deletes the target, tombstones its id, and repairs affected arrows in the same change set.
2. Binding updates validate target state, preserve the untouched terminal, and recompute arrow geometry from server-current state.
3. Target transform/geometry changes repair bound arrows in the same server clock as the target mutation.
4. Delete/binding/repair limit violations reject atomically without partial state changes.
5. Tombstone retention prevents accidental resurrection and idempotent delete retry replays the original ACK.
   **Plans**: 1 plan

Plans:

- [x] 05.8-01: Implement authoritative delete tombstones, binding update planning, arrow repair, and AC tests.

### Phase 5.9: P5-09 Replace document for import/restore

**Goal**: Saved-room native import and future restore replace the whole document through the
authoritative sync room path, bump `roomEpoch`, tombstone removed records, rebuild slot clocks, and
broadcast one authoritative replacement payload.
**Depends on**: Phase 5.8
**Source**: `docs/SPECS.md` `[P5-09]`
**Canonical refs**: `docs/SPECS.md`, `specs/038-p5-09-replace-document-import-restore/acceptance.md`
**Requirements**: [P5-09-AC-1, P5-09-AC-2, P5-09-AC-3, P5-09-AC-4, P5-09-AC-5, P5-09-AC-6]
**Success Criteria** (what must be TRUE):

1. Saved-document import executes a `ReplaceDocumentCommand` through `SyncRoom` persistence.
2. Replace increments `roomEpoch` and stale pre-replace commands reject by epoch.
3. Removed active ids become tombstones, incoming records get fresh slot clocks, and same-id type
   changes do not retain old slot clocks.
4. Realtime peers can hydrate from `ROOM_REPLACED` as a single server truth.
5. Client replacement reconciliation clears pending work and ignores stale ACKs.
   **Plans**: 2 plans

Plans:

- [x] 05.9-01: Backend replace document command and import adapter path.
- [x] 05.9-02: Frontend ROOM_REPLACED reconciliation and verification.

### Phase 5.10: P5-10 Export adapters use materialized server truth

**Goal**: Saved-document native export reads materialized server truth instead of stale frontend
state, while native import/export adapters share normalization and reporting.
**Depends on**: Phase 5.9
**Source**: `docs/SPECS.md` `[P5-10]`
**Canonical refs**: `docs/SPECS.md`, `specs/039-p5-10-export-server-truth/acceptance.md`
**Requirements**: [P5-10-AC-1, P5-10-AC-2, P5-10-AC-3, P5-10-AC-4]
**Success Criteria** (what must be TRUE):

1. Saved-document export fetches the materialized server snapshot from the SyncRoom/repository path.
2. Export reflects latest committed server edits without mutating documentClock.
3. Native round-trip preserves element metadata, camera, room metadata, and asset references.
4. Unsupported malformed element objects are skipped with report data and do not half-mutate a saved document.
   **Plans**: 1 plan

Plans:

- [x] 05.10-01: Implement saved native export server truth, shared normalization/reporting, and AC tests.

### Phase 5.11: P5-11 Frontend reconciliation

**Goal**: Saved-room frontend mutation capture and reconciliation use P5 `SyncCommand` queues with
bounded durable drag flushing, slot-aware ACK/broadcast/diff application, reconnect-safe pending
replay, and ephemeral presence/draft previews.
**Depends on**: Phase 5.10
**Source**: `docs/SPECS.md` `[P5-11]`
**Canonical refs**: `docs/SPECS.md`, `specs/040-p5-11-frontend-reconciliation/acceptance.md`
**Requirements**: [P5-11-AC-1, P5-11-AC-2, P5-11-AC-3, P5-11-AC-4, P5-11-AC-5, P5-11-AC-6, P5-11-AC-7, P5-11-AC-8]
**Success Criteria** (what must be TRUE):

1. Continuous drag produces bounded durable P5 patch commands and always sends the final pointerup patch.
2. Backpressure squashes only eligible unsent patch slots while preserving first inverseChanges and never dropping create/delete/replace/binding commands.
3. Slot-aware reconciliation preserves independent peer slot changes, ignores stale ACK payloads, and applies reconnect pending statuses without double-applying processed commands.
4. Initial undo emits only safe single-slot inverse patches when the slot clock still matches the recorded after clock.
5. Presence, cursor, selection, and draft preview remain ephemeral and do not become persisted SyncCommands.
   **Plans**: 1 plan

Plans:

- [x] 05.11-01: Implement frontend P5 command queue, reconciliation lifecycle, and AC tests.

### Phase 2.57: P2.5-07 Merge items + bind text vào container

**Goal**: Provide a "merge items" MVP that groups multiple elements into one operational unit via
`groupId`, with the most important case being binding exactly one text label into exactly one
container shape so the label follows the container's move/resize/delete/z-order.
**Depends on**: Phase 2.51
**Source**: `docs/SPECS.md` `[P2.5-07]`
**Canonical refs**: `docs/SPECS.md`, `specs/048-merge-items-bind-text/acceptance.md`
**Requirements**: [AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13]
**Success Criteria** (what must be TRUE):

1. Merge/Unmerge commands (context menu + Cmd/Ctrl+G / Cmd/Ctrl+Shift+G) assign/clear a shared
   `groupId` across selections, joining an existing group instead of minting a new id unless 2+
   distinct groups are merged together (which flattens into one new `groupId`).
2. Merging exactly one `text` with exactly one container-eligible shape binds the text as a
   centered, width-wrapped label with a higher `zIndex`, and any other text/container combination
   produces a plain group instead.
3. Group move, resize, delete, copy/duplicate, and z-order commands treat bound text and grouped
   elements as one unit (delta move, bbox recenter/rewrap, cascade delete, new `groupId` on copy,
   z-order following the container), all through the existing mutation pipeline as one undoable
   step.
4. No new WebSocket event types are introduced; `groupId` reuses the `grouping.groupId` slot
   already defined in the sync contracts.
   **Plans**: 3 plans

Plans:

- [x] 02.57-01-PLAN.md — Merge/Unmerge commands (context menu + Cmd/Ctrl+G / Cmd/Ctrl+Shift+G), join-vs-flatten rule, group-aware delete cascade, copy/duplicate groupId remap (AC-1, AC-2, AC-3, AC-10, AC-11, AC-12).
- [x] 02.57-02-PLAN.md — Text-binding at merge: derived resolveGroupBinding, jsdom-safe text-wrap, centered/wrapped/higher-zIndex label, move/resize/delete + z-order cascade to bound text (AC-4, AC-5, AC-6, AC-7, AC-12).
- [x] 02.57-03-PLAN.md — Group-bbox resize + full group-drag + D-01 group-click selection: non-text scaling, bound-text recenter/rewrap, independent-text position-only (D-03), no-new-slot regression (AC-8, AC-9, AC-12, AC-13).

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
| 4.7. P4-07 Version history + owner restore       | 1/1            | Complete | 2026-07-03 |
| 5.1. P5-01 Module boundary & legacy removal      | 1/1            | Complete | 2026-07-02 |
| 5.2. P5-02 Shared sync contracts                 | 1/1            | Complete | 2026-07-02 |
| 5.3. P5-03 Server-authoritative SyncRoom         | 1/1            | Complete | 2026-07-02 |
| 5.4. P5-04 Conflict resolution & validation      | 1/1            | Complete | 2026-07-02 |
| 5.5. P5-05 Change sets + ACK/broadcast           | 1/1            | Complete | 2026-07-02 |
| 5.6. P5-06 Transactional persistence             | 3/3            | Complete | 2026-07-02 |
| 5.7. P5-07 Load, reconnect & diff                | 1/1            | Complete | 2026-07-02 |
| 5.8. P5-08 Delete, tombstone & binding repair    | 1/1            | Complete | 2026-07-02 |
| 5.9. P5-09 Replace document import/restore       | 2/2            | Complete | 2026-07-02 |
| 5.10. P5-10 Export adapters server truth         | 1/1            | Complete | 2026-07-02 |
| 5.11. P5-11 Frontend reconciliation              | 1/1            | Complete | 2026-07-02 |
