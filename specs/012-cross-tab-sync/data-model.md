# Data Model: Cross-Tab Sync (BroadcastChannel)

## Entities

### BroadcastChannel Message

The only data structure that crosses tab boundaries.

```ts
interface BCMessage {
  elements: Element[];
}
```

- `elements`: array of `Element` objects (the existing type from `src/types/shared.ts`)
- No additional fields — Principle V (Sync Data Not Renderer)

### Element (existing, unchanged)

Key fields relevant to LWW:

| Field | Type | Role |
|-------|------|------|
| `id` | `string` | Identity — match against store |
| `version` | `number` | LWW primary key — higher wins |
| `versionNonce` | `number` | LWW tiebreak — lower wins |
| `isDeleted` | `boolean` | Soft-delete flag — propagated via LWW |

No new fields are added to `Element`.

## State Transitions

```
Remote element received
  ↓
id not in store?
  → YES: Add element (no LWW comparison)
  → NO: Compare version/nonce
        ↓
        Wins LWW?
          → YES: Update element in store
          → NO:  Discard (local version is authoritative)
```

```
Local mutation fires
  ↓
isApplyingRemote()?
  → YES: Skip broadcast (avoid echo loop)
  → NO:  postMessage({ elements }) to BroadcastChannel
```
