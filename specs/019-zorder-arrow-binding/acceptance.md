# Acceptance Criteria: Z-order UI & Arrow Binding

**Feature**: P2.5-02 (Z-order UI) + P2.5-03 (Arrow Binding)
**Spec**: [spec.md](./spec.md)
**Created**: 2026-06-28
**Status**: Frozen — append-only after this point

---

## Z-order UI (P2.5-02)

**AC-1**: Given two overlapping shapes A (below) and B (above), when the user selects A and triggers "Bring to Front", then A is rendered above B and all other clients in the room see A on top without refreshing.

**AC-2**: Given three shapes with shape C at the top, when the user selects C and triggers "Send to Back", then C is rendered below all others for all clients.

**AC-3**: Given shape A directly below shape B, when the user selects A and triggers "Forward", then A moves exactly one position higher (above B) and other relative orderings are unchanged for all clients.

**AC-4**: Given shape A directly above shape B, when the user selects A and triggers "Backward", then A moves exactly one position lower (below B) and other relative orderings are unchanged for all clients.

**AC-5**: Given a shape already at the topmost position, when the user triggers "Bring to Front" or "Forward", then the stacking order does not change and no error is shown.

**AC-6**: Given a shape already at the bottommost position, when the user triggers "Send to Back" or "Backward", then the stacking order does not change and no error is shown.

**AC-7**: Given multiple shapes are selected, when the user opens the z-order controls, then the controls are visually disabled (greyed out) or absent so no partial/ambiguous update can occur.

---

## Arrow Binding (P2.5-03)

**AC-8**: Given an arrow being drawn, when the user releases an endpoint within the snap threshold of a shape, then the endpoint snaps to the nearest attachment point on that shape and the binding is persisted on the arrow element.

**AC-9**: Given an arrow endpoint bound to a shape, when the user moves the bound shape, then the arrow endpoint repositions automatically to maintain the visual connection.

**AC-10**: Given an arrow endpoint bound to a shape, when the user resizes the bound shape, then the arrow endpoint repositions to reflect the new shape geometry.

**AC-11**: Given an arrow endpoint bound to a shape, when the bound shape is deleted, then the arrow endpoint is released to the shape's last position and the arrow itself is not deleted.

**AC-12**: Given an arrow endpoint bound to a shape, when the endpoint is dragged beyond the snap threshold and released on empty canvas, then the binding is removed and the endpoint is placed at the release position.

**AC-13**: Given an arrow endpoint released outside any shape's snap threshold, when the endpoint is placed, then no binding is recorded and the endpoint is free.

---

## Sync (both features)

**AC-14**: Given two clients in the same room, when client A changes z-order of any element, then client B's canvas reflects the new stacking order within 500 ms.

**AC-15**: Given two clients in the same room, when client A binds or unbinds an arrow endpoint, then client B sees the updated binding state within 500 ms.

**AC-16**: Given two clients in the same room, when client A moves a shape that has a bound arrow, then client B sees both the shape and arrow reposition in real time.

---

## Undo/Redo

**AC-17**: Given a z-order change was just applied, when the user triggers Undo, then the element's stacking position reverts to its previous value atomically.

**AC-18**: Given an arrow binding was just created or removed, when the user triggers Undo, then the binding state reverts to its previous value atomically.
