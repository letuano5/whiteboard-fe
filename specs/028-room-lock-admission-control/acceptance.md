# Acceptance Criteria

AC-1: The Share modal exposes participant/editor capacity controls without a room lock/unlock control.
AC-2: Capacity settings reject malformed values, values above configured maximums, and `maxEditors > maxParticipants`.
AC-3: When `maxParticipants` is reached, an additional user cannot join the room and receives a clear admission error instead of an empty or local board.
AC-4: When `maxEditors` is reached, a user whose `baseRole` is `editor` can still join as `effectiveRole = 'viewer'`.
AC-5: Presence and online-user surfaces expose each participant's `baseRole` and `effectiveRole` so the frontend can explain why editing controls are unavailable.
AC-6: The first P4 implementation requires rejoin or reload to receive a newly available editor slot after an editor leaves; realtime queues and auto-promotion are not required for correctness.
