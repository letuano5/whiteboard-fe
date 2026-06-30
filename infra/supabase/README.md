# Supabase Local Docker Foundation

This folder vendors the official Supabase Docker support files for P3B local auth work.

- Source repository: `https://github.com/supabase/supabase`
- Source commit: `16ce2c1a8a17105cd7a797c20e357c7ac67d15d8`
- Vendored support path: `infra/supabase/docker`
- Project compose file: `docker-compose.yml`

The root compose is based on the official default compose from the source commit above. At the
time of copying, it pins:

- Postgres: `supabase/postgres:17.6.1.136`
- Auth: `supabase/gotrue:v2.189.0`
- Kong: `kong/kong:3.9.1`

For local setup, edit the root `.env`, rotate the default secrets, then run Docker Compose from
the repository root:

```bash
docker compose up -d
```

By default, the local stack starts only the services currently needed by the app:
`db`, `auth`, and `kong`. The `db` service exposes `${POSTGRES_PORT}` directly for host
Prisma/backend development. Supavisor and the remaining vendored Supabase services are kept in
`docker-compose.yml` under the `supabase-full` profile for later phases.

To start the full vendored Supabase stack:

```bash
docker compose --profile supabase-full up -d
```

Generated Postgres data lives under `infra/supabase/docker/volumes/db/data`. Do not commit this
directory.

## Rebuilding Local Postgres

Use this only when you intentionally want a clean local/dev database. The project does not provide
an automatic destructive reset script; deleting local data must be an explicit developer action.

1. Stop the local Supabase stack:

   ```bash
   docker compose down
   ```

2. Remove the physical Postgres data directory after confirming that no local data needs to be
   preserved:

   ```bash
   rm -rf infra/supabase/docker/volumes/db/data
   ```

3. Recreate the directory and start Supabase again:

   ```bash
   mkdir -p infra/supabase/docker/volumes/db/data
   docker compose up -d db auth kong
   ```

4. Rerun the application Prisma migrations against the clean Supabase Postgres:

   ```bash
   pnpm db:migrate
   ```

If Prisma cannot connect, confirm that `DATABASE_URL` points at the local Supabase Postgres service
and that the `db` healthcheck has passed.

## App User Boundary

Supabase Auth owns authentication tables such as `auth.users`. Application code must not edit those
tables directly. After a token is verified through the backend auth verifier, the backend should
sync or upsert any app user/profile data into app-owned tables in the `public` schema through
Prisma.

JWT claims prove identity only. Room authorization must be resolved from application data, with
`RoomMember.role` as the source of truth for owner/editor/viewer decisions. Business logic should
not derive room permissions directly from JWT claims or from direct reads of `auth.users`.
