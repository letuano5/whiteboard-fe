# Acceptance Criteria Registry — 014-realtime-sync-broadcast

> Append-only. AC-n IDs are frozen once any test references them.
> Distilled from spec.md acceptance scenarios (2026-06-27).

## P2-02 — Realtime Broadcast

AC-1: When User A creates a new element in room X, User B (also in room X) receives the element and it appears on their canvas within ~200 ms.
AC-2: When User A moves an existing element, User B in the same room sees the element at the updated position.
AC-3: When User A deletes an element (soft-delete), User B in the same room sees the deletion reflected on their canvas.
AC-4: A change made by User A in room X is NOT received by User B in a different room Y (room isolation, enforced server-side).

## P2-03 — Optimistic Local Update

AC-5: When a user performs an action (create/move/delete), the canvas reflects the change immediately — before any server acknowledgement.

## P2-04 — LWW Conflict Resolution

AC-6: Incoming element with strictly higher version than local → incoming wins (applied to local store).
AC-7: Incoming element with strictly lower version than local → local wins (incoming is discarded).
AC-8: Incoming element with equal version and lower versionNonce than local → incoming wins (lower nonce tiebreaks).
AC-9: Incoming element with equal version and higher-or-equal versionNonce than local → local wins (incoming is discarded).
AC-10: After any sequence of concurrent edits, all clients in the same room converge to the same element state.

## P2-05 — Reject Remote When Actively Editing

AC-11: A remote update for an element that the local user is currently dragging is ignored (the drag is not disrupted).
AC-12: A remote update for an element that the local user is currently resizing or rotating is ignored (the interaction is not disrupted).
AC-13: A remote update for an element that the local user is currently text-editing is ignored (the text session is not disrupted).
AC-14: After a local drag/resize/rotate/text-edit completes, the element state converges via LWW (the previously deferred remote update may win if its version is higher).
