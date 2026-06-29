# Research: Remote Selection Highlight & Draft Preview (P2.5-04)

**Date**: 2026-06-28

## Decision 1 — How to broadcast `selectedIds`

**Decision**: Extend the existing `cursor-move` WS event payload with an optional `selectedIds: string[]` field, relayed as-is by the server.

**Rationale**:
- `cursor-move` is already a low-latency, unreliable relay (no storage, fire-and-forget).
- Selection changes often coincide with cursor interaction, so co-locating them avoids a second round-trip.
- The server already relays `cursor-move` to peers without touching the payload — forwarding `selectedIds` requires zero server logic change beyond passing the field through.
- Adding a separate `selection-change` event would add a new WS event type and new handler on both ends for no architectural benefit.

**Alternatives considered**:
- *Separate `selection-change` event*: cleaner semantics, but unnecessary overhead (two events for one user action); rejected.
- *Embedding in `element-update`*: would conflate ephemeral state with committed state; rejected (Constitution Principle V).

---

## Decision 2 — How to broadcast draft/in-progress element state

**Decision**: Introduce a new `element-draft` WS event (added to `WS_EVENTS` in `@vdt/shared`). The event carries `{ sessionId, roomId, elements: Element[] }`. The server relays it without storing.

**Rationale**:
- Draft state is fundamentally different from committed state (`element-update` goes through `applyRemoteElements` → `elements.store`). Mixing the two would violate Constitution Principle VII.
- A dedicated event makes it trivial for receivers to route draft payloads into `interaction.store` (transient) instead of `elements.store` (committed).
- The server handler is identical to cursor-move: receive → relay to room, no storage.

**Alternatives considered**:
- *Reuse `element-update` with a `isDraft` flag*: the flag would need to be checked in `applyRemoteElements`, branching committed vs transient handling; messy and fragile; rejected.
- *Encode draft in `cursor-move` payload*: cursor-move is designed for tiny presence data (cursor position, viewport, selection IDs). Embedding full `Element[]` objects bloats every cursor event; rejected.

---

## Decision 3 — Where to subscribe and emit draft updates (frontend)

**Decision**: In `socket-client.ts`, subscribe to `interaction.store`'s `draftElement` and `draftElements` fields (just as it already subscribes to `camera.store`). Throttle emission at 50 ms. Do not add emit calls inside individual tool files.

**Rationale**:
- `socket-client.ts` is the single networking entry point; centralizing all emission here keeps tools free of socket knowledge.
- `zustand.subscribe()` is already used for camera broadcasting — the same pattern is consistent and testable.
- 50 ms throttle ≈ 20 FPS of draft updates, which is visually fluid without flooding the server.

**Alternatives considered**:
- *Emit from `select-tool.ts`*: couples the tool layer to the network layer; rejected.
- *Emit from mutation pipeline*: draft changes don't go through the pipeline (they're not committed); pipeline hook is not the right trigger; rejected.

---

## Decision 4 — Where to store remote draft state

**Decision**: Add `remoteDrafts: Map<string, Element[]>` to `InteractionState` (and `setRemoteDrafts` action), keyed by `sessionId`. Lives exclusively in `interaction.store`.

**Rationale**:
- Constitution Principle VII mandates transient state in `interaction.store`, never in `elements.store`.
- The existing `remoteCursors` map uses the same `sessionId` key, so cleanup on `USER_LEAVE` is symmetric.
- `Element[]` is the minimal shape needed for rendering; no extra wrapper type required.

**Alternatives considered**:
- *Store in `elements.store` with a `isDraft` flag*: violates Principle VII; rejected.
- *A separate `remoteDrafts.store.ts`*: unnecessary third store for what is conceptually part of interaction/presence state; rejected.

---

## Decision 5 — Visual style for remote selection highlights and draft ghosts

**Decision**:
- **Remote selection highlight**: solid colored border (1.5 px, peer's `color`), no handles, no rotate handle, no dashes. Rendered below the local selection overlay z-order so local always wins visibility.
- **Remote draft ghost**: render using `ShapeUtil.render()` at 50% opacity + a colored 1 px border matching the peer's color. No handles.

**Rationale**:
- A solid (not dashed) border for remote selections differentiates them from the dashed blue of the local selection overlay without being confusing.
- Using the peer's existing `color` from `Presence` means no new color infrastructure is needed.
- Rendering via the same `ShapeUtil` pattern (Constitution Principle IV) means draft ghosts work for all element types automatically.
- Opacity 50% is a well-established convention for "in-progress / not yet committed" state (same as local `draftElement` at 0.6).

---

## Decision 6 — Draft cleanup on commit / disconnect

**Decision**:
- When `element-update` arrives from a peer (via `ELEMENT_UPDATE` socket event), clear that peer's draft: `remoteDrafts.delete(sessionId)`.
- When `USER_LEAVE` fires, already clears `remoteCursors`; also clear from `remoteDrafts` in the same handler.
- Draft for an unknown element (ID not in `elements.store`) is silently discarded during render — no special handling needed.

**Rationale**: Keeps cleanup centralized in socket-client event handlers, symmetric with how `remoteCursors` is cleaned up today.
