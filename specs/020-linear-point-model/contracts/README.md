# Contracts

This feature has no external interface changes (REST, WebSocket events, or public API).

The `Element` data structure sent over Socket.IO is unchanged. The semantic change
(points as source of truth) is internal to the frontend pipeline.

The only observable effect on the sync protocol is that `x,y,width,height` on
committed `arrow`/`line` elements will always be the normalised bbox — but this
was already the intended encoding; the fix only enforces it consistently.
