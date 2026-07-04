# Acceptance Criteria

AC-1: Continuous drag sends durable sync patches no more often than the 100ms flush window, does not create an unbounded queue, and always sends the final pointerup patch.
AC-2: Squashing unsent slot patches keeps the latest changes but preserves inverseChanges from the first before-state in the window; backpressure never drops create/delete/replace/binding commands and pauses for resync when overload cannot be squashed.
AC-3: When client A drags a shape while client B changes a different slot such as fill color, reconciliation preserves B's committed color and A's final accepted drag.
AC-4: Late ACKs with an old serverClock clear only their matching pending request and never overwrite newer optimistic state.
AC-5: Reload/reconnect pending status handling does not double-apply commands already processed by the server.
AC-6: Initial undo support only emits an inverse single-slot patch when the slot clock still equals the original edit's afterSlotClock; if the slot changed, undo reports a conflict/manual retry instead of auto-applying.
AC-7: Pending create followed by patch/delete preserves dependency order after reconnect and never sends a patch/delete for an element before its create.
AC-8: Presence, cursor, selection, and draft preview remain ephemeral and are not sent as SlotPatch/SyncCommand persistence mutations.
