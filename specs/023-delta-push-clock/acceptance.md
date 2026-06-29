# Acceptance Criteria

AC-1: Given two clients are in the same room with server documentClock = N, when client A sends one ELEMENT_UPDATE batch, then the server broadcasts ELEMENT_UPDATE to peer clients with the same elements, the sender sessionId when provided, and documentClock = N + 1.

AC-2: Given one ELEMENT_UPDATE batch contains multiple elements, when the server processes the batch, then documentClock increments exactly once for the whole batch and every active record or tombstone persisted by the next autosave uses that same documentClock as recordClock or deletedClock.

AC-3: Given two ELEMENT_UPDATE batches are processed consecutively for the same room, when both broadcasts are emitted, then their documentClock values are monotonic consecutive values N + 1 and N + 2.

AC-4: Given a room clock has not been initialized in memory, when the room is joined or receives its first update, then the server initializes the in-memory room clock from the persisted Room.documentClock when available, or 0 for a new room, before applying the next increment.

AC-5: Given a client has lastServerClock from ROOM_SNAPSHOT, when it receives an ELEMENT_UPDATE payload containing documentClock, then getLastServerClock() returns that documentClock for future reconnect joins.

AC-6: Given a client receives a legacy ELEMENT_UPDATE payload without documentClock, when the handler runs, then getLastServerClock() remains unchanged while element merge behavior still runs.

AC-7: Given the backend has active rooms and idle clients, when no user-initiated updates occur, then no timer-based full-room resync emits ROOM_RESYNC or a full element set to clients.

AC-8: Given clock management belongs to the server, when the frontend sends ELEMENT_UPDATE, then the client payload does not include per-element sent-version tracking or a client-authored documentClock.
