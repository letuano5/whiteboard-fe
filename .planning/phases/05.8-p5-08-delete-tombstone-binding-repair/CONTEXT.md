# Phase 5.8 Context: P5-08 Delete, tombstone & binding repair

## Source

- Canonical scope: `docs/SPECS.md` `[P5-08]`.
- Acceptance registry: `specs/037-p5-08-delete-tombstone-binding-repair/acceptance.md`.
- GSD mapping: repo roadmap ID `P5-08` maps to GSD Phase `5.8`.

## Locked Decisions

- Backend `SyncRoom` remains the authoritative write path for saved-room document mutations.
- `DeleteElementsCommand` must delete active records, add tombstones through the existing `deleted`
  change-set path, and repair affected active arrows in the same committed change set.
- Arrow binding repair is server-side. Clients may request `UpdateArrowBindingCommand`, but server
  uses current arrow and target state to recompute endpoint geometry.
- P5 binding payloads use `ArrowEndpointBinding` objects. Legacy string bindings may exist in older
  elements and should be treated as repairable references when deleting/moving targets, then normalized
  to `null` when cleared.
- Binding target transform changes (`transform.position`, `transform.size`, `transform.rotation`) and
  linear target geometry changes repair bound arrows in the same `serverClock`.
- Delete/import/replace resurrection behavior remains conservative in P5-08: create is still rejected
  for ids in tombstone retention. Full replace/import semantics belong to P5-09.

## Non-goals

- No frontend command migration for arrow binding capture; P5-11 owns full frontend reconciliation.
- No route/pathfinding algorithm beyond deterministic endpoint recompute from anchor ratios.
- No binary asset storage, version-history restore path, or replace-document import/restore rewrite.

## Acceptance Mapping

- `AC-1`, `AC-2`: delete bound target repairs arrow bindings and emits full slot patches.
- `AC-3`: tombstone retention prevents accidental resurrection.
- `AC-4`: delete, repair, and change-set limits reject atomically.
- `AC-5`: target transform/geometry mutation repairs bound arrows in the same clock.
- `AC-6`: start/end binding updates merge by terminal and recompute geometry from server state.
- `AC-7`: invalid binding target rejects before commit.
- `AC-8`: tombstoned delete rejects, original retry replays ACK.
