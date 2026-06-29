# Data Model: Realtime Sync & Broadcast

This feature adds no new data entities. It operates entirely on the existing `Element` type
defined in `packages/shared/src/index.ts`.

## Key Fields Used by This Feature

| Field | Type | Role |
|-------|------|------|
| `id` | `string` | Identifies which element to update in the local store |
| `version` | `number` | Primary LWW discriminator — higher wins |
| `versionNonce` | `number` | Tiebreaker when `version` values are equal — lower wins |
| `updatedAt` | `number` | Timestamp (informational; LWW uses version+nonce only) |
| `isDeleted` | `boolean` | Soft-delete flag propagated via sync |

## Active Interaction Guard (interaction.store)

The following transient fields (from `interaction.store.ts`) gate whether a remote update
is applied. They are read-only from `applyRemoteElements`'s perspective.

| Field | When set | Guard effect |
|-------|----------|--------------|
| `draggingId` | User is dragging an element | Remote updates for that element are skipped |
| `resizeSession` | User is resizing any selected element | Remote updates for all `selectedIds` are skipped |
| `isRotating` | User is rotating any selected element | Remote updates for all `selectedIds` are skipped |
| `editingId` | User is text-editing an element | Remote updates for that element are skipped |

## Socket Payload Shape

```ts
// Emitted and received as:
{ roomId: string; elements: Element[] }  // emit (client → server)
{ elements: Element[] }                  // receive (server → client)
```

Only `Element[]` crosses the network boundary (Constitution Principle V).
