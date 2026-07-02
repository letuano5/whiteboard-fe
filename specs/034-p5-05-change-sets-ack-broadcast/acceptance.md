# Acceptance Criteria

AC-1: Ack `commit` and `rebase` both clear the sender's matching pending request.
AC-2: A broadcast from the same origin actor can clear pending when the ACK is missed.
AC-3: Reject clears the matching rejected pending request without blindly rolling back slots that have newer pending changes.
AC-4: Rebase applies reconciliation from the server `changeSet` and does not enqueue or push the same command again.
AC-5: Client reconciliation applies a slot-only `CommittedChangeSet` without replacing the whole element.
