# Acceptance Criteria

AC-1: DeleteElementsCommand for a bound target removes the deleted record, records a tombstone, and clears every arrow binding that references the deleted element so no active arrow points at a dead id.
AC-2: Delete repair emits full slot patches for repaired arrows, including binding and geometry slots, so peers applying the same CommittedChangeSet reach the same arrow state as the sender.
AC-3: Create/import/replace paths must not resurrect an element id that is inside tombstone retention unless the replace/import path explicitly owns that behavior in a later phase.
AC-4: Commands that exceed delete, repaired-arrow, or change-set limits reject with TOO_LARGE and leave document state unchanged.
AC-5: Moving, resizing, or rotating a bound target recomputes affected arrow endpoint geometry in the same server clock as the target mutation.
AC-6: Concurrent updates to startBinding and endBinding on the same arrow preserve both terminals and recompute geometry from server-current arrow and target state.
AC-7: Binding to a missing or deleted target rejects with INVALID_BINDING_TARGET before commit.
AC-8: A new delete request for an already tombstoned element rejects with ELEMENT_DELETED, while retrying the original delete request with the same actor/request id replays the original ACK.
