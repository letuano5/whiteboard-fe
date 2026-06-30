# P3B-00c Local DB Reset and App-User Boundary Docs - Acceptance Criteria

Status: Shipped

AC-1: Local documentation explains how to rebuild local/dev from a clean Supabase Postgres by stopping compose, removing the old physical data directory, recreating it, starting compose, and rerunning Prisma migrations.
AC-2: The repository does not add an automatic destructive reset script; destructive local data removal requires an explicit developer action.
AC-3: Documentation states that application code must not modify `auth.users` directly; app user/profile data belongs in app-owned `public` schema tables managed through Prisma after token verification.
AC-4: Documentation states that JWTs prove identity only, and room authorization resolves roles from app data such as `RoomMember.role`.
AC-5: The Supabase Postgres reset docs use the existing compose PGDATA path `infra/supabase/docker/volumes/db/data` and keep it out of git.
AC-6: Default Docker Compose startup includes only local app-needed services, exposes Postgres directly for host Prisma/backend dev, and keeps Supavisor plus unused vendored Supabase services behind an explicit full-stack profile.

Delta notes:
- Change: use existing compose PGDATA path instead of moving data to `.data/postgres`. Reason: preserve the current Supabase vendored Docker layout and avoid surprising local data relocation.
- Change: put Supavisor and currently unused vendored Supabase services behind `supabase-full`, while exposing `db` directly. Reason: keep local P3B startup focused and avoid Supavisor tenant-id requirements for host Prisma.
