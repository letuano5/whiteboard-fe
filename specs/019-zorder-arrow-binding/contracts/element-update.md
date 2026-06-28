# Contract: element-update WebSocket Event

**Feature**: P2.5-02 + P2.5-03 | **Date**: 2026-06-28

## Summary

No new WebSocket events are introduced for Z-order UI or Arrow Binding. Both features piggyback on
the existing `element-update` event (`WS_EVENTS.ELEMENT_UPDATE`) which carries a full `Element`
payload. The server relays this event to all other clients in the room without modification.

## Event: `element-update`

**Direction**: client → server → all other clients in room

**Payload**: `Element` (full object from `@vdt/shared`)

```typescript
// Relevant fields for this feature:
{
  id: string;
  zIndex: number;           // changed by z-order commands
  props: {
    startBinding: string | null;  // changed by arrow binding snap/release
    endBinding:   string | null;  // changed by arrow binding snap/release
    points: [number, number][];   // updated when endpoint repositions due to binding
    // ... other props unchanged
  };
  version: number;          // always incremented
  versionNonce: number;     // always re-randomised
  updatedAt: number;
  // ... all other Element fields
}
```

## Conflict Resolution

Last-Write-Wins (LWW): if two clients simultaneously change `zIndex` of the same element, the
client with the higher `version` wins. `versionNonce` breaks ties deterministically. This is the
existing mechanism and requires no changes for this feature.

## Backend

The backend (`backend/src/`) requires **no changes**. The existing `element-update` handler already
relays the full element payload.
