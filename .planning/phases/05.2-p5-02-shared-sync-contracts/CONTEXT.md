# Phase 5.2 Context: P5-02 Shared Sync Contracts

## Source

- Canonical roadmap block: `docs/SPECS.md` `[P5-02]`
- Acceptance registry: `specs/031-p5-02-shared-sync-contracts/acceptance.md`
- GSD mapping: repo roadmap ID `P5-02` maps to GSD Phase `5.2`.

## Locked Decisions

- P5-02 owns shared contracts only. It must not implement the final server-authoritative
  `SyncRoom`, room actor, persistence transaction, realtime ack/rebase flow, or frontend
  reconciliation.
- Shared P5 contracts live in `@vdt/shared`; backend P5-01 compatibility commands remain
  backend-internal until later phases replace them.
- The minimum slot vocabulary comes from `docs/SPECS.md` and must include:
  `transform.position`, `transform.size`, `transform.rotation`, `style.*`, `text.*`,
  `geometry.points`, `geometry.route`, `geometry.startPoint`, `geometry.endPoint`,
  `binding.start`, `binding.end`, `order`, `asset.src`, `embed.url`, `grouping.groupId`,
  `grouping.frameId`.
- Existing `Element.version`, `versionNonce`, and `updatedAt` are legacy metadata for P1-P4
  compatibility and must not become the P5 conflict source.
- Shared command payloads must not include or trust `actorId`; authenticated socket/session
  context supplies actor identity on the server.
- `order` is a domain command concern. `PatchSlotsCommand` must reject direct `order` slot
  patches in this phase.
- `isDeleted` is not patchable slot state; deletion uses `DeleteElementsCommand`.
- Create commands may carry an input element plus order hints, but the change-set contract must
  represent the final server-materialized element and normalized order.
- `SlotReadPrecondition` uses `baseClock` and `onStale` rather than `expectedClock`; shared helpers
  must distinguish stale branches for `reject`, `rebase`, and `server_recompute`.
- Slot clocks are normalized numbers. A slot that has never been set uses `baseClock = 0`, `null`
  clocks are invalid, and `baseClock > currentSlotClock` is `STALE_CLIENT_STATE`.
- `UpdateArrowBindingCommand` uses P5 `ArrowEndpointBinding` payloads with `arrowId`, `terminal`,
  `binding`, `baseBindingClock`, and `baseGeometryClock`; it must not trust client geometry.
- P5 command ACK semantics are command-level only: one `requestId` per command, no `batchId`, and no
  patch-level request/ack fields in this first protocol slice.

## Non-Goals

- Do not remove `ELEMENT_UPDATE` or legacy frontend `applyRemoteElements`.
- Do not wire P5 contracts into Socket.IO handlers yet.
- Do not implement DB slot clock persistence, idempotency storage, rebase, or reconnect diff.
- Do not change native file schema or import/export UI.

## Acceptance Mapping

- `AC-1`: covered by shared field-map exports and tests that compare every `Element` field and
  `ElementProps` field against the mapping/classification registry.
- `AC-2`: covered by shared validation tests for invalid `SlotPatch` payloads and duplicate slots.
- `AC-3`: covered by shared command envelope tests and actor-field rejection tests.
- `AC-4`: covered by create validation/materialization tests for duplicate active/tombstone IDs
  and final order in change-set types.
- `AC-5`: covered by validation tests proving `PatchSlotsCommand` rejects `order` while
  `ReorderElementsCommand` accepts order changes.
- `AC-6`: covered by slot clock validation tests for `baseClock = 0`, `null` clocks, and
  `STALE_CLIENT_STATE`.
- `AC-7`: covered by read-precondition helper tests for `reject`, `rebase`, and
  `server_recompute` stale branches.
- `AC-8`: covered by arrow-binding command tests and command-level request/patch-level ACK rejection
  tests.
