# Socket Event Contract: element-update

## Event Name
`element-update` (from `WS_EVENTS.ELEMENT_UPDATE` in `@vdt/shared`)

## Client → Server

Emitted by the socket mutation hook after any local element change.

```ts
socket.emit('element-update', {
  roomId: string,    // the room this client has joined
  elements: Element[] // one or more elements with updated version/versionNonce
})
```

**Trigger**: Every `MutationEvent` fired by the mutation pipeline, unless `isApplyingRemote()` is true (prevents echo).

## Server → Client (broadcast)

Relayed by the server to all other clients in the same room.

```ts
socket.to(roomId).emit('element-update', {
  elements: Element[]  // same elements, roomId stripped
})
```

**Guarantee**: The sender does NOT receive its own broadcast (`socket.to(roomId)` excludes sender).

## Client receive handler

```ts
socket.on('element-update', (data: { elements: Element[] }) => {
  applyRemoteElements(data.elements);
})
```

`applyRemoteElements` applies LWW and the active-interaction guard before writing to store.
