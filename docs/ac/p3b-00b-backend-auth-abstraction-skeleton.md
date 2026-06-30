# P3B-00b Backend Auth Abstraction Skeleton - Acceptance Criteria

Status: Shipped

AC-1: Backend code defines an auth verifier contract and normalized identity containing `provider`, `providerSubject`, `email`, `name`, and `avatarUrl`.
AC-2: Backend includes a provider adapter/stub that verifies through the abstraction and returns typed failures for missing or invalid credentials.
AC-3: Backend domain code does not call Supabase SDK/API directly in this slice.
AC-4: This slice does not attach auth to real HTTP or Socket.IO request handling.
AC-5: Verified JWT identity remains separate from room authorization; verifier results do not include room roles or membership decisions.

Delta notes:
