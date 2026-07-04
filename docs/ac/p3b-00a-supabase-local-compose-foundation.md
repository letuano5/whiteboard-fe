# P3B-00a Supabase Local Compose Foundation - Acceptance Criteria

Status: Shipped

AC-1: The repository includes a copied Supabase docker foundation with the official init SQL files needed by the Supabase Postgres/Auth stack.
AC-2: The local compose setup runs Supabase `db`, `auth`, and `kong` services, exposing the standard Supabase API surface including `/auth/v1`.
AC-3: The Supabase database service uses `supabase/postgres:17.6.1.136`.
AC-4: The Supabase Auth image is pinned to the version from the copied official compose source.
AC-5: Local environment samples document `SUPABASE_PUBLIC_URL`, anon/service role keys, JWT secret, and a backend database URL targeting Supabase Postgres.
AC-6: The slice does not delete, reset, or rebuild any local data directory.

Delta notes:
- Change: use one root `docker-compose.yml` based on the official Supabase default compose instead of a separate compose under `infra/supabase/docker`. Reason: project local dev should start from one compose file at the repo root.
