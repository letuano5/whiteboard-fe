# Data Model: Remote Selection Highlight & Draft Preview (P2.5-04)

**Date**: 2026-06-28

---

## Entities

### 1. `Presence` (existing — `packages/shared/src/index.ts`)

No schema change required. The `selectedIds: string[]` field already exists.

```typescript
// Already exists — no change needed
interface Presence {
  sessionId: string;
  userId?: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedIds: string[];          // ← already present; will now be broadcast
  status: 'active' | 'idle' | 'away';
  viewport?: { x: number; y: number; zoom: number };
}
```

### 2. `WS_EVENTS` — new constant (existing file `packages/shared/src/index.ts`)

Add one constant:

```typescript
ELEMENT_DRAFT: 'element-draft',
```

Full updated object:

```typescript
export const WS_EVENTS = {
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  ELEMENT_CREATE: 'element-create',
  ELEMENT_UPDATE: 'element-update',
  ELEMENT_DELETE: 'element-delete',
  ELEMENT_DRAFT: 'element-draft',   // NEW
  CURSOR_MOVE: 'cursor-move',
  USER_JOIN: 'user-join',
  USER_LEAVE: 'user-leave',
  ROOM_SNAPSHOT: 'room-snapshot',
  ROOM_RESYNC: 'room-resync',
} as const;
```

### 3. `InteractionState` — new field (existing `frontend/src/types/interaction.ts`)

Add one field:

```typescript
remoteDrafts: Map<string, Element[]>;   // sessionId → transient draft elements from that peer
```

Full change in `InteractionState`:

```typescript
export interface InteractionState {
  // ... all existing fields unchanged ...
  remoteDrafts: Map<string, Element[]>;  // NEW
}
```

---

## WS Payload Contracts

### `cursor-move` event (extended — both directions)

**Client → Server:**
```typescript
{
  roomId: string;
  sessionId: string;
  cursor: { x: number; y: number } | null;
  viewport?: { x: number; y: number; zoom: number };
  selectedIds?: string[];    // NEW — optional; omitted if selection hasn't changed
}
```

**Server → Peers (relay):**
```typescript
{
  sessionId: string;
  cursor: { x: number; y: number } | null;
  viewport?: { x: number; y: number; zoom: number };
  selectedIds?: string[];    // NEW — passed through from sender
}
```

### `element-draft` event (NEW — both directions)

**Client → Server:**
```typescript
{
  roomId: string;
  sessionId: string;
  elements: Element[];    // current in-flight draft positions/sizes (1–N elements)
}
```

**Server → Peers (relay, no storage):**
```typescript
{
  sessionId: string;
  elements: Element[];
}
```

**Draft clear signal:** When `elements` is an empty array (`[]`), the receiver MUST clear that peer's draft from `remoteDrafts`. This handles cancellation (Escape key) and normal commit (peer's committed `element-update` arrives after the draft).

---

## State Transitions

### Remote Selection

```
Peer selects elements
  → emit cursor-move with selectedIds
  → server relays to room
  → receiver updates remoteCursors[sessionId].selectedIds
  → SvgLayer re-renders remote selection borders

Peer deselects (selectedIds=[])
  → same flow; borders disappear

Peer disconnects
  → USER_LEAVE removes sessionId from remoteCursors
  → SvgLayer renders nothing for that peer
```

### Remote Draft

```
Peer starts dragging element
  → interaction.store.draftElements populated
  → socket-client subscription fires (throttled 50ms)
  → emit element-draft with current draftElements
  → server relays to room
  → receiver writes to remoteDrafts[sessionId]
  → SvgLayer renders ghost at new position

Peer commits (pointer up)
  → patchElement / updateElements called → element-update emitted
  → receiver's applyRemoteElements updates committed store
  → receiver's ELEMENT_UPDATE handler clears remoteDrafts[sessionId]
  → ghost disappears, committed element renders at final position

Peer cancels (Escape)
  → local draft cleared → draftElements = []
  → socket-client subscription fires → emit element-draft with elements=[]
  → receiver clears remoteDrafts[sessionId]
  → ghost disappears, element snaps back to committed position

Peer disconnects mid-drag
  → USER_LEAVE fires → clear remoteDrafts[sessionId]
  → ghost disappears
```

---

## Rendering Layers (SvgLayer.tsx)

Render order within `<g transform={camera}>` (bottom to top):

1. Committed elements (`visible` array) — unchanged
2. **Remote draft ghosts** (NEW) — 50% opacity, colored 1 px border
3. Local draft element / draftElements — unchanged (existing at 0.6 opacity)
4. **Remote selection highlights** (NEW) — solid colored border, no handles
5. Local selection overlay (single select handles, multi-select bbox) — unchanged
6. Marquee rubber-band — unchanged
7. Laser trail — unchanged
