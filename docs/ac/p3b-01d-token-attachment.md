# P3B-01d Token Attachment - Acceptance Criteria

Status: Shipped

AC-1: Socket.IO client connections include `auth.accessToken` when the frontend auth store has a current session token.
AC-2: Socket.IO client connections omit auth token data when no frontend session token exists.
AC-3: Frontend HTTP requests can use a shared authenticated fetch helper that attaches `Authorization: Bearer <token>` while preserving caller-provided headers.
AC-4: App bootstrap restores frontend auth state before initializing a room socket connection.
AC-5: This slice does not enforce room roles, enable backend socket auth by default, or upsert app users in the database.

Delta notes:

- None.
