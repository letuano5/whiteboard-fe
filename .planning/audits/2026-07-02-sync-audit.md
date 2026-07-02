# Sync Layer Audit — 2026-07-02

Scope: P5 server-authoritative sync rewrite (backend/src/sync, backend/src/realtime/handlers,
packages/shared/src/sync-contracts, frontend/src/sync/socket/p5-*). Read-only audit; no fixes applied.
AC references = specs/040-p5-11-frontend-reconciliation/acceptance.md.

---

## 1. Correctness Bugs (ranked)

### CRITICAL

**C1 — Multi-patch commands are split into queue entries sharing one requestId → server rejects all but the first → silent data loss.**
- `frontend/src/sync/socket/p5-command-backpressure.ts:25` (`enqueueCoalescedPatch`) and `:46-66` (`compactPatchCommand`): each non-coalescible patch of a `patch-slots` command is appended as `{ ...next, command: { ...next.command, patches: [patch] } }` — same `requestId` per entry.
- Server: `backend/src/sync/sync-room.ts:133-139` — second command with same actorId+requestId but different payloadHash → `DUPLICATE_REQUEST_CONFLICT` reject.
- Failure scenario: resize a rectangle (one mutation → patches `transform.position` + `transform.size` → 2 queue entries, same requestId). Both flushed (MAX_IN_FLIGHT=2). First commits, second rejected → size change never reaches server, reverts locally on next re-materialization. Same for multi-select drag (N `transform.position` patches → N entries → N−1 elements snap back) and any multi-prop style change.
- Fix direction: keep a multi-patch command as ONE queue entry and coalesce per element:slot inside it; if splitting is required, mint a fresh requestId per split entry.

**C2 — Legacy autosave flush clobbers P5 persistence (wipes Record.slotClocks, bumps recordClock, can regress state).**
- `backend/src/realtime/handlers/sync-command.ts:51` calls `autosave.markDirty` after every P5 commit; `backend/src/realtime/handlers/disconnect.ts:21` flushes on last disconnect. Autosave (`backend/src/index.ts:24-32`) flushes the `roomElements` mirror through legacy `saveRoomElements` with **no slotClocksMap** → `backend/src/persistence/room-repository/save-room.ts:63,75,83` rewrites every Record with `slotClocks: {}` and `recordClock = targetClock`.
- Consequences: (a) after any SyncRoom reload (server restart or `recoverUnhealthy`) all slot clocks read 0 — connected clients' in-flight patches with `baseClock > 0` are rejected as `STALE_CLIENT_STATE` by the future-clock check (`packages/shared/src/sync-contracts/slot-validation.ts:63-67`) until they fully resync; conflict/LWW detection and slot-level reconnect diffs silently reset. (b) `recordClock` bumped for ALL rows → every subsequent reconnect diff returns the entire room. (c) Race: the flush is not serialized with the room actor and has no conditional guard on Record rows — a flush snapshotting the mirror just before a concurrent P5 commit can overwrite the newer `record.state` with older data in the DB (memory stays correct → silent memory/DB divergence for reconnecting clients until the element is next touched).
- Fix direction: do not `markDirty`/flush P5-persisted rooms at all (their commit is already transactional); keep autosave only for legacy non-persisted rooms, or route the flush through `SyncRoomPersistence`.

### HIGH

**H1 — Reconnect diff never enforces the roomEpoch boundary (violates the Phase 5.7 decision).**
- `backend/src/persistence/room-repository/room-diff.ts:95`: wipe condition is `lastServerClock < roomEpoch` — compares a clock to an epoch counter (different units, epoch is a small replace-count). The client's `options.roomEpoch` is accepted (`:12-16`) but never compared to the server's epoch.
- Effect: after replace-document, a reconnect returns `mode:'diff'` crossing the epoch. Content happens to be complete (replace re-stamps kept records at the replace clock and tombstones removals), so this mostly works by accident — but the documented "wipe-all across epoch" invariant is unimplemented, client-side stale-epoch cleanup that assumes a wipe never runs, and rooms with epoch > small clocks get spurious wipes. `tombstoneHistoryStartsAtClock` is also always 0 (never written; `backend/src/rooms/room-access-records.ts:125`) so the tombstone-GC wipe guard is dead code (harmless today because tombstones are never GC'd).
- Fix direction: pass and compare the client epoch: `if (options.roomEpoch !== undefined && options.roomEpoch !== roomEpoch) → wipe`. Drop the `lastServerClock < roomEpoch` comparison.

**H2 — Anonymous sockets can mutate any saved room without join/access checks.**
- `backend/src/realtime/handlers/sync-command.ts:66-72`: `if (!user) return socket.data?.roomRole ?? 'editor'` — an unauthenticated socket that never joined the target room (or joined a *different* room; `command.roomId` is never checked against `socket.data.roomId`) is granted `editor` and the command executes, including on `private` rooms. `resolveRoomAccess` correctly denies anonymous users on private rooms (`backend/src/rooms/room-roles.ts:103-111`) but is only called for authenticated users. Same pattern in `element-update.ts:39`.
- Fix direction: resolve access via `resolveRoomAccess(db, roomId, undefined)` for anonymous users too, and require `socket.data.roomId === command.roomId`.

**H3 — Arrow bindings created in the UI never reach the server.**
- `frontend/src/canvas/tools/select/pointer-up.ts:105-108` stores bindings as legacy strings (`bindingStr`); `frontend/src/sync/socket/p5-change-set.ts:199-210` (`slotValueFromElement`) maps string bindings to `null` → `diffElementSlots` sees null→null → no `binding.*` patch. No frontend code creates `update-arrow-binding` commands (only handled in switch statements: `p5-command-materializer.ts:142,170`, `p5-command-resync.ts:46`).
- Effect: server never learns about new/changed bindings → P5-08 server-authoritative binding repair never fires for them; arrows follow their targets only on the local client; on other clients and after reload the binding does not exist.
- Fix direction: emit `update-arrow-binding` (with `ArrowEndpointBinding` object + base clocks) from the endpoint-drop path, and migrate legacy string bindings to objects at the pipeline boundary.

**H4 — Every move/resize of linear elements (line/arrow/freehand/highlighter) is rejected wholesale by the server.**
- `frontend/src/sync/socket/p5-command-materializer.ts:117-132` diffs all PATCHABLE_SLOTS regardless of element type; a linear drag/commit changes `x/y` (`pointer-up.ts:46-49,120-144`) → emits `transform.position` (and `transform.size` on resize) alongside `geometry.points`.
- Server: `backend/src/sync/sync-room-slot-patches.ts:13-16` throws `INVALID_SLOT_FOR_ELEMENT_TYPE` for `transform.*` on linear types (intent confirmed by `sync-room-conflict-validation.test.ts:239-242`), rejecting the ENTIRE patch-slots command including the valid `geometry.points` patch. Bound arrows additionally trip `:20-26` (`geometry.startPoint/endPoint` with binding present).
- Effect: dragging any line/arrow/freehand never syncs and reverts locally after the next remote event.
- Fix direction: make `diffElementSlots` element-type-aware (skip `transform.*` for linear, skip `geometry.*` for non-linear, skip bound endpoints); server bounds are recomputed from points anyway (`applyGeometryPoints`).

**H5 — Reconnect resend reverses command order, breaking create→patch dependency (AC-7).**
- `frontend/src/sync/socket/p5-command-queue.ts:148`: each `unknown`-status in-flight command is re-queued with unshift (`[{...sent}, ...queued]`). Statuses arrive in original send order, so N unknown commands end up REVERSED in the queue.
- Failure: pending `create(X)` then `patch(X)` at disconnect; on reconnect both `unknown` → queue becomes `[patch, create]`. The flush dependency gate (`:79-86`) only blocks when the create is IN-FLIGHT, not when it is queued behind → patch sent first → `ELEMENT_NOT_FOUND` reject → patch lost (create still applies).
- Fix direction: append re-queued commands preserving original order (or sort by original `createdAt`), and make the dependency gate also check `queuedSyncCommands` ahead-of-position.

### MEDIUM

**M1 — Rejected/stale commands leave phantom optimistic state in the store.**
- `frontend/src/sync/socket/p5-reconciliation.ts:67-72` (reject without `serverChangeSet`) and `frontend/src/sync/socket/event-handlers.ts:61-70` (post-snapshot `markPendingRequestsStale`) remove commands from queues without re-running `materializeOptimisticElements` → the command's optimistic effect stays visible until an unrelated event re-materializes. With no further traffic it persists indefinitely.
- Fix direction: re-materialize from `serverElements` after every queue mutation triggered by reject/stale/reconcile.

**M2 — AC-6 undo guard exists but is not wired; undo can silently clobber concurrent edits.**
- `frontend/src/sync/socket/p5-command-queue.ts:164` (`createUndoPatchCommand`) has zero callers; undo goes through `history.store` → `updateElements` → plain patch-slots with no slot-clock equality check. Even when wired, the check is client-side only — the command carries no `readPreconditions` with `onStale:'reject'`, so a server-side race window remains (server LWW-applies stale baseClocks as `rebase`).
- Fix direction: route undo through `createUndoPatchCommand` and attach a `reject` read precondition so the server enforces the clock-equality invariant.

**M3 — Reconnect "diff" ships the whole room every time.**
- `backend/src/persistence/room-repository/room-diff.ts:130-139`: all in-memory mirror elements not in the DB-changed set are appended to `changed` unfiltered by clock. Since the mirror holds the full room, every diff ≈ full snapshot. Correctness survives only because the client skips changed elements with no slotClock entries (`p5-reconciliation.ts:154`) — a brittle cross-layer coupling; bandwidth benefit of diffing is nil.
- Fix direction: restrict the overlay to legacy (non-P5) rooms, or drop it once all saved-room mutations flow through SyncRoom.

**M4 — Fail-open fallbacks in access/diff paths.**
- `backend/src/realtime/handlers/join-room.ts:45-60`: DB error during access resolution for an anonymous user grants full `editor` + `link_edit`.
- `backend/src/realtime/handlers/element-update.ts:94-96`: `isPersistedRoom` returns `false` on DB error → legacy mutation path allowed on a saved room (mirror + autosave overwrite, compounding C2).
- `backend/src/realtime/handlers/room-diff-request.ts:63-73`: error fallback echoes the client's own `roomEpoch` and empty `slotClocks` with `wipeAll` → wipes the client's clock table to zeros.
- Fix direction: fail closed (viewer/none) on access errors; treat `isPersistedRoom` DB error as "persisted"; error fallback should send an explicit resync-later error instead of a fabricated snapshot.

**M5 — Two SyncRoom instances can exist for one room (check-then-act race).**
- `backend/src/sync/sync-room-registry.ts:18-33`: concurrent `getOrCreateSyncRoom` calls both miss the map, both await `loadRoomElements`, second `set` overwrites first while the first caller keeps its reference → two actors accept commands for the same room. The conditional documentClock update makes this self-healing (loser hits `CONDITIONAL_CLOCK_CONFLICT` → `recoverUnhealthy` → reload) so it degrades to spurious `ROOM_UNHEALTHY` rejects, not divergence. Import eviction (`backend/src/rooms/native-file-import.ts:141`) widens the window.
- Fix direction: cache `Promise<SyncRoom>` in the map synchronously before awaiting the load.

**M6 — Replace-document does not clear pre-replace tombstones.**
- `backend/src/sync/sync-room-planner.ts:72-90` + `sync-room.ts:222-239` + persistence: tombstones for ids deleted *before* the replace survive the epoch bump (memory and DB). Creating an element with such an id after an import is rejected `DUPLICATE_ELEMENT_ID` ("tombstone retention") even though the epoch semantics say the old history is void.
- Fix direction: on `replace_document`, clear all tombstones not re-introduced by the replace itself (memory set + DB table), consistent with the wipe-all boundary.

### LOW

**L1 — ProcessedRequest storage blowup; no GC.**
- `backend/src/sync/sync-room-payload-hash.ts:5-7`: "payloadHash" is the full canonical JSON, not a hash — for replace-document that is the entire document; `ack: commit.result` stores the full changeset again (`sync-room-persistence.ts:240-253`). In-memory `processedRequests` map grows unbounded per room (`sync-room.ts:213`); `processedRequestHistoryStartsAtClock` is never advanced (no GC job), so `expired` statuses (`room-diff.ts:182`) can never occur.
- Fix: real SHA-256 hash; periodic GC advancing the history-start clock.

**L2 — Slot-clock key parsing inconsistency.**
- `sync-room.ts:260` splits on first `:`; `join-room.ts:219` splits on last `:`. Element ids containing `:` would corrupt one of them. IDs are UUIDs today — latent only. Use the shared `getSlotClockKey`/one parser.

**L3 — `CLOCK_OVERFLOW` defined but never enforced** (`sync-room.ts:157` increments unchecked; only `load-room.ts:78-84` guards at load). Cosmetic at realistic scales.

**L4 — Per-command O(n) copying.**
- `getStateSnapshot()` copies all maps per command (planner input), `mirrorSyncRoomState` copies the full element map per command (`sync-command.ts:83-91`), `previewSlotClocks` copies all slot clocks (`sync-room.ts:246-255`), `toRecordSlotClocksJson` scans all slot clocks per touched element (`sync-room-persistence.ts:269-281`). Fine for hundreds of elements; a ceiling for thousands.

**L5 — Transient/relaxed command path is dead code today.**
- No frontend caller dispatches `sync: { final: false }` mutations, so no transient patches are ever produced; AC-1's 100ms transient machinery is unexercised. Latent trap: `enqueueCoalescedPatch` keeps the OLD entry's envelope when coalescing, so a final durable patch coalesced into a queued transient entry would be sent as transient/non-resendable (`p5-command-backpressure.ts:12-23`). Will bite when transient drags are enabled.

### AC-1..AC-8 verdicts (specs/040)

| AC | Verdict | Evidence / counter-scenario |
|----|---------|------------------------------|
| AC-1 | Letter: pass; spirit: unexercised | 100ms window + final flush exist (`p5-command-queue.ts:25,62,233-247`) but nothing produces non-final mutations (L5); drags preview via ELEMENT_DRAFT and commit once at pointer-up. Final patch is sent. C1 undermines multi-slot finals. |
| AC-2 | Fail in effect | Squash keeps first `inverseChanges` (`p5-command-backpressure.ts:19,63`) ✓; pause-for-resync on overflow (`p5-command-queue.ts:249-259`) ✓; but C1's shared-requestId split means content of multi-patch commands IS dropped (server rejects siblings). |
| AC-3 | Pass (single-slot) | Server merges different slots (`sync-room-planner.ts:203-261`); client applies per-slot patches and re-materializes pendings (`p5-change-set.ts:10-44`, `p5-command-queue.ts:155-162`). C1 caveat for multi-slot commands. |
| AC-4 | Pass with caveat | Stale ACKs ignored via `serverClock <= lastServerClock` (`p5-reconciliation.ts:198`); only matching pending cleared (`:64-65`). Caveat M1: reject ACKs don't re-materialize (phantom state). |
| AC-5 | Pass | `processed` statuses drop commands from both queues (`p5-command-queue.ts:120-134`); durable ProcessedRequest replay returns original ACK without re-applying (`sync-room.ts:133-154`). Edge: commands sent between reconnect-join and snapshot get staled and rely on gap-diff to converge (display-only). |
| AC-6 | FAIL | `createUndoPatchCommand` has no callers (M2); undo path performs no slot-clock equality check and no server-side reject precondition. |
| AC-7 | FAIL on reconnect | Dependency gate + create-cancel + patch-squash correct live (`p5-command-queue.ts:79-86,203-216,292-316`), but H5's unshift reversal sends patch before its create after reconnect. |
| AC-8 | Pass | Cursor/selection/viewport → CURSOR_MOVE, drafts → ELEMENT_DRAFT relay only (`element-draft.ts:5-8`; drafts live in interaction store, never in elements store); no path from ephemeral state into SlotPatch/SyncCommand; documentClock advances only inside `SyncRoom.execute`. |

---

## 2. Architecture Analysis

### Strengths
- **Server sequencing without OT/CRDT**: per-room actor + monotonic documentClock + conditional DB update gives a total order and makes multi-writer DB corruption structurally impossible (races degrade to reload, not divergence). Right-sized for a single-instance deployment.
- **Slot-level conflict unit**: concurrent move+recolor merge instead of whole-element clobber (the P1–P4 `applyRemoteElements` LWW loses one side); delete-wins is explicit via tombstones; server-generated repairs (arrow bindings) commit atomically in the same changeset as their trigger — an invariant Excalidraw simply cannot express.
- **Durable idempotency in the commit transaction** (`ProcessedRequest` + payload comparison): exactly-once per requestId across reconnects/restarts. Stronger than Excalidraw (none) and than tlsync's in-memory dedup.
- **One payload shape** (`CommittedChangeSet`) for ACK/broadcast/persistence/diff keeps reconciliation code paths from diverging.
- **roomEpoch as replace boundary** is the right concept for import/restore (even though enforcement is currently missing, H1).

### Weaknesses — tradeoff vs mistake
| Weakness | Verdict |
|---|---|
| Dual persistence writers (P5 transactional commit + legacy autosave mirror flush) → C2 | **Mistake.** Not a scale tradeoff; two writers with different schemas on the same rows. Migration leftover that must be removed. |
| Epoch boundary unimplemented in diff (H1) | **Mistake** (cheap fix); currently correct-by-accident. |
| Diff overlay ships whole room (M3) | Half-tradeoff (belt-and-braces during legacy migration), but should be scoped to legacy rooms — as-is it defeats diffing. |
| One Postgres transaction per command (latency floor, throughput ceiling) | **Reasonable tradeoff** at this scale; the transient/relaxed path exists to amortize drags. tldraw batches persistence instead — better throughput, weaker durability. |
| O(n) snapshot/mirror copies per command (L4) | Acceptable now; revisit past ~1k elements/room. |
| Frontend queue machinery (transient path, split/coalesce) built ahead of need, under-tested → C1, H5, L5 | **Mistake in implementation**, not concept: complexity landed before an e2e exercise of resize/multi-drag/reconnect paths. |
| No protocol/schema migration story (hard reject on version mismatch) | Acceptable for a thesis; tlsync's record migrations are the reference if documents must survive schema evolution. |
| payloadHash = full JSON, no ProcessedRequest GC (L1) | Mistake, cheap fix. |

### Comparison
| Dimension | This project (P5) | tldraw (tlsync) | Excalidraw | Figma |
|---|---|---|---|---|
| Authority | Server-authoritative; per-room actor; Postgres conditional commit per command | Server-authoritative; in-memory room, periodic snapshot persistence | Thin relay; no server authority | Server-authoritative; server-sequenced ops |
| Conflict unit | Per-field slot (25 slots), latest-to-server LWW; delete-wins | Whole-record diff/patch with sub-record patches, clock-based | Whole-element `version`+`versionNonce` LWW | Per-property LWW; tree ops server-validated |
| Idempotency | Durable (Postgres ProcessedRequest, replay returns original ACK) | Push-request dedup, in-memory | None (convergence via LWW) | Sequence/ack protocol |
| Reconnect | Snapshot vs clock-keyed diff + epoch boundary (intended), tombstone retention | Diff since clock or full state | Full scene broadcast + LWW merge | Full tree resync |
| Presence | Separate events, never persisted ✓ | Separate presence records ✓ | Separate volatile channel ✓ | Separate ✓ |
| Durability | Every durable command committed transactionally before ACK | Batched/periodic → can lose recent ops on crash | Whatever clients hold | Server log |
| vs this project | — | Stronger: migration story, batching throughput. Weaker: durability granularity, idempotency durability. | This project strictly stronger on authority, deletes, merges, idempotency. | Equivalent conflict semantics (property LWW); Figma adds tree-structure OT this app doesn't need (flat frames/groups). |

Verdict: slot-LWW + server sequencing + durable idempotency keys is a sound, well-chosen middle point between Excalidraw's "no authority" and a CRDT. A CRDT (Yjs/Automerge) would buy offline merge and P2P at the cost of: server no longer able to validate/repair (binding repair, reference validation, role enforcement become advisory), tombstone growth, and much harder server-side authority — for a room-scoped, online-first, permissioned whiteboard, the chosen design is the better fit. The bugs found are implementation defects, not consequences of the architecture.

### Scaling ceiling (SPECS §12 / P3D)
- Bindings to one process: `syncRooms` Map + in-process `RoomActor`, `roomElements`/`roomClocks` mirrors, socket.io without an adapter, autosave timers.
- What already helps: the conditional documentClock update makes a second instance *safe* (loser reloads) — correctness survives horizontal scaling; throughput would thrash (every contended command = reload+retry).
- Migration path (tractable, no rework of the core): (1) per-room sticky routing (consistent hash on roomId); (2) socket.io Redis adapter for cross-instance broadcast; (3) drop the roomElements mirror (P5 rooms don't need it — see C2/M3); (4) keep `SyncRoomPersistence` as the seam — it already is the right interface. The actor model itself ports cleanly to "one owner instance per room".

---

## 3. Prioritized Recommendations

1. **[bug-fix] C1** — stop splitting multi-patch commands across entries sharing a requestId (single entry per command; coalesce inside). Effort: **S**. Unblocks resize/multi-drag correctness.
2. **[bug-fix] C2** — stop autosave/mirror flush for P5-persisted rooms (remove `markDirty` in sync-command handler + guard `flushRoomNow`); autosave remains for legacy rooms only. Effort: **S**.
3. **[bug-fix] H4** — make `diffElementSlots` element-type-aware (no `transform.*` for linear, no `geometry.*` for non-linear, no bound endpoints). Effort: **S**.
4. **[bug-fix] H2** — enforce access for anonymous sockets in `handleSyncCommand` (resolveRoomAccess + roomId/join check). Effort: **S**.
5. **[bug-fix] H3** — emit `update-arrow-binding` from the endpoint-bind flow; migrate string bindings to `ArrowEndpointBinding`. Effort: **M**.
6. **[bug-fix] H1** — compare client `roomEpoch` to server epoch in `computeRoomDiff`; wipe on mismatch; delete the `lastServerClock < roomEpoch` comparison. Effort: **S**.
7. **[bug-fix] H5** — preserve original order when re-queuing unknown pending commands; extend the dependency gate to queued creates. Effort: **S**.
8. **[bug-fix] M1** — re-materialize optimistic elements after reject/stale/reconcile queue mutations. Effort: **S**.
9. **[bug-fix] M5** — cache `Promise<SyncRoom>` in the registry map before awaiting the DB load. Effort: **S**.
10. **[bug-fix] M4** — fail closed on access-resolution/DB errors (join-room anonymous fallback, `isPersistedRoom`, diff error fallback). Effort: **S**.
11. **[design-change] M2/AC-6** — wire undo through `createUndoPatchCommand` and add `readPreconditions` with `onStale:'reject'` so the server enforces it. Effort: **M**.
12. **[design-change] L1** — SHA-256 for payloadHash; GC job for ProcessedRequest advancing `processedRequestHistoryStartsAtClock`; cap in-memory `processedRequests`. Effort: **M**.
13. **[design-change] M3** — scope the in-memory diff overlay to legacy rooms; let P5 rooms diff purely from Postgres. Effort: **M**.
14. **[design-change] M6** — clear stale tombstones on `replace_document` (memory + DB). Effort: **S**.
15. **[design-change] scale prep (only if P3D pursued)** — Redis adapter + per-room sticky routing + drop mirrors. Effort: **L**.

Overall: the backend core (SyncRoom/planner/persistence) is solid — findings there are boundary/integration defects (autosave leftover, epoch check, registry race). The frontend P5-11 layer is where correctness actually breaks today (C1, H3, H4, H5, M1, M2); it needs an e2e pass over resize, multi-drag, linear elements, bindings, and reconnect-with-pending before it can be called verified.
