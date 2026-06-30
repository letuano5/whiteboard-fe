# P3B-01b Backend Socket Auth Middleware - Acceptance Criteria

Status: Shipped

AC-1: Socket auth middleware extracts an access token from the Socket.IO handshake and verifies it through the existing AuthVerifier abstraction.
AC-2: On successful verification, socket handlers can read the normalized identity from `socket.data.auth.identity` without depending on a provider SDK.
AC-3: Missing or invalid credentials reject the socket connection with a stable auth error code and do not attach identity data.
AC-4: Unexpected verifier failures are passed to Socket.IO middleware error handling without being rewritten as auth failures.
AC-5: `createWhiteboardServer` installs socket auth only when an AuthVerifier is provided, and this slice does not perform room authorization, frontend session handling, or app-user database upsert.

Delta notes:

- None.
