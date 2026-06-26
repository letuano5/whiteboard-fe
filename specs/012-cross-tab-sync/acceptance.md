# Acceptance Criteria Registry — 012-cross-tab-sync

> Append-only. AC-n IDs are frozen once any test references them.
> Distilled from spec.md acceptance scenarios.

AC-1: A new element created in Tab A appears in Tab B within ~100 ms (no manual refresh).
AC-2: Moving or resizing an element in Tab A causes the updated position/size to appear in Tab B.
AC-3: Soft-deleting an element in Tab A removes it from Tab B's canvas.
AC-4: Changing an element's style properties (stroke, fill, opacity, etc.) in Tab A reflects in Tab B.
AC-5: Incoming element with higher `version` than local → applied (higher version wins LWW).
AC-6: Incoming element with lower `version` than local → ignored (local version wins LWW).
AC-7: Incoming element with equal `version` and lower `versionNonce` than local → applied (lower nonce tiebreaks).
AC-8: Incoming element with equal `version` and higher `versionNonce` than local → ignored.
AC-9: An element currently being dragged in the local tab is NOT overwritten by a concurrent remote update.
AC-10: An element currently being resized or rotated in the local tab is NOT overwritten by a concurrent remote update.
AC-11: An element currently being text-edited in the local tab is NOT overwritten by a concurrent remote update.
AC-12: Remote changes applied to the store are persisted to localStorage (Tab B canvas survives a reload).
AC-13: The BroadcastChannel does not echo messages back to the sender tab (no double-apply).
AC-14: `applyRemoteElements` is a single function reused by both BroadcastChannel and Socket.IO paths (no duplication).
