# Acceptance Criteria

AC-1: Commands submitted concurrently to the same saved room execute through a per-room serialized actor so planning, commit, state application, and result enqueueing cannot interleave.
AC-2: Commands submitted to different rooms execute through independent room actors and are not blocked by unrelated room work.
AC-3: Duplicate or retried commands with the same actor and request ID return the original committed result without applying side effects a second time.
