# P3B-01e App User Upsert - Acceptance Criteria

Status: Shipped

AC-1: Prisma schema defines an app-owned user table with normalized `provider` and `providerSubject`, unique per provider subject, and without reading or modifying Supabase `auth.users`.
AC-2: Backend app-user repository upserts an internal app user from a verified identity and updates profile fields on later logins.
AC-3: HTTP auth middleware can attach both verified identity and app user to downstream handlers when an app-user repository is injected.
AC-4: Socket auth middleware can attach both verified identity and app user to `socket.data.auth` when an app-user repository is injected.
AC-5: Missing or invalid credentials do not upsert app users, and this slice does not perform room role authorization or frontend session handling.

Delta notes:

- None.
