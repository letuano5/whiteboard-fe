# BroadcastChannel Message Contract

**Channel name**: `VDT_WHITEBOARD`

**Direction**: Any tab → all other same-origin tabs (BroadcastChannel does not echo to sender)

## Message Format

```ts
{
  elements: Element[]   // one or more elements that changed
}
```

## Rules

- `elements` array contains only the elements affected by the triggering mutation (not the full scene).
- Each `Element` carries its current `version`, `versionNonce`, `updatedAt`, and `isDeleted` state.
- Camera, interaction state, and laser trail are NEVER included.
- Receivers apply LWW via `applyRemoteElements` — they do not echo the message back.

## Lifecycle

- Channel is opened in `initBroadcastChannel()` at app startup.
- Channel is closed in `stopBroadcastChannel()` on app unmount / test teardown.
- If `BroadcastChannel` is not available in the runtime (e.g., test environment without polyfill), `initBroadcastChannel` returns early — the whiteboard works as a single-tab editor.
