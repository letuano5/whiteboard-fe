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

Do not commit generated data under `infra/supabase/docker/volumes/db/data`.
