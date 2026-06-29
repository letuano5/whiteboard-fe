# Research Notes: Live Cursor & Online Users

**Date**: 2026-06-27

## Decisions

### Throttle implementation

- **Decision**: Manual timestamp-based throttle (track `lastSentAt` ref, skip if `Date.now() - lastSentAt < 33`)
- **Rationale**: No lodash or external library needed; ~33 ms = ~30 fps, matches spec requirement. Simpler than `setInterval` polling.
- **Alternatives considered**: `setInterval` (more complex, sends even when cursor is still), lodash throttle (unnecessary dependency).

### Session identity generation

- **Decision**: Generate `sessionId` via `crypto.randomUUID()`, pick `name` from a curated list of short animal-adjective pairs, pick `color` from a 10-color hex palette — all at module load time.
- **Rationale**: No auth in P2. Identity must be stable for the tab's lifetime (not regenerated on re-render). Module-level const guarantees stability.
- **Alternatives considered**: `localStorage` persistence (not needed — presence is ephemeral per session), server-assigned (adds round-trip before first join).

### Presence storage on server

- **Decision**: `Map<roomId, Map<socketId, Presence>>` in-memory.
- **Rationale**: No persistence needed (P3A adds DB). Socket ID as key enables O(1) cleanup on disconnect.
- **Alternatives considered**: Map keyed by sessionId (would need a socketId→sessionId reverse lookup for cleanup).

### Cursor coordinate space

- **Decision**: Always transmit world coordinates. Convert screen→world before emitting; convert world→screen when rendering the overlay.
- **Rationale**: World coordinates are camera-independent; all peers see cursors at the correct canvas position regardless of their zoom/pan state.

### USER_JOIN payload strategy

- **Decision**: Server emits full `presences: Presence[]` array (all current room members) to the entire room on every join event.
- **Rationale**: Simplest way to bootstrap a new joiner's state AND keep existing members in sync without a separate "room-snapshot" event for presence.
- **Alternatives considered**: Separate "here-is-who-is-already-here" event for new joiners only (more complex, two code paths).

### CursorOverlay positioning

- **Decision**: Full-viewport absolute div with `pointer-events: none`, individual cursors positioned with `position: absolute; left: screenX; top: screenY`.
- **Rationale**: Doesn't interfere with canvas interactions. Uses existing `worldToScreen()` util.
- **Alternatives considered**: SVG overlay (harder to style name labels with HTML), Canvas overlay (overkill, reserved for P3C ink).
