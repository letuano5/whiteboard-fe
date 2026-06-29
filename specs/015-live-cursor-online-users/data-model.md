# Data Model: Live Cursor & Online Users

## Presence (from `@vdt/shared`)

```ts
interface Presence {
  sessionId: string;       // UUID v4, generated client-side at tab open
  userId?: string;         // undefined in P2 (no auth)
  name: string;            // e.g. "Blue Fox" — display name for this session
  color: string;           // hex color e.g. "#3b82f6" — used for cursor + badge
  cursor: { x: number; y: number } | null;  // world coords; null when off-canvas
  selectedIds: string[];   // P2.5 — empty for now
  status: 'active' | 'idle' | 'away';       // P4 — always 'active' for now
  viewport?: { x: number; y: number; zoom: number }; // P4 follow-mode — unused
}
```

No changes to `@vdt/shared` needed — `Presence` type and `WS_EVENTS` constants are already defined.

## LocalPresence (client-only)

```ts
interface LocalPresence {
  sessionId: string;
  name: string;
  color: string;
}
```

Module-level const exported from `frontend/src/sync/presence.ts`. Stable for the tab's lifetime.

## Server-side presence store

```ts
// In backend/src/index.ts
const roomPresence = new Map<string, Map<string, Presence>>();
// Outer key: roomId
// Inner key: socketId (enables O(1) cleanup on disconnect)
// Value:     Presence (sessionId, name, color, cursor: null — server never stores cursor position)
// Note: socketId ≠ sessionId. socketId is the internal server key; sessionId is what clients use
//       to identify each other. Both are stored: socket.data.sessionId for lookup on disconnect.
```

## WebSocket payloads

### Client → Server

| Event | Payload |
|-------|---------|
| `join-room` | `{ roomId: string; sessionId: string; name: string; color: string }` |
| `cursor-move` | `{ roomId: string; sessionId: string; cursor: { x: number; y: number } }` |

### Server → Client

| Event | Payload |
|-------|---------|
| `user-join` | `{ presences: Presence[] }` — full list of all current room members |
| `user-leave` | `{ sessionId: string }` |
| `cursor-move` | `{ sessionId: string; cursor: { x: number; y: number } }` |

## State location

| Data | Store | Why |
|------|-------|-----|
| `remoteCursors: Map<string, Presence>` | `interaction.store` (transient) | Ephemeral; must never be persisted or synced as elements |
| `localPresence` | Module-level const in `presence.ts` | Stable for tab lifetime; not reactive state |
