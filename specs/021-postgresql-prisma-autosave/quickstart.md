# Quickstart: PostgreSQL Prisma Autosave

## Prerequisites

1. Install workspace dependencies:

   ```bash
   pnpm install
   ```

2. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

3. Ensure `DATABASE_URL` is available from `.env` or the shell.

## Build-Time Validation

1. Generate Prisma client:

   ```bash
   pnpm --filter whiteboard-be prisma generate
   ```

2. Apply the initial migration locally:

   ```bash
   pnpm --filter whiteboard-be prisma migrate dev --name init-persistence
   ```

## Automated Acceptance Validation

Run backend tests:

```bash
pnpm --filter whiteboard-be test --run
```

Expected:
- `room-repository.test.ts` covers AC-1 through AC-4 plus AC-9 and AC-10.
- `autosave.test.ts` covers AC-5 through AC-7 and AC-10.
- `socket-autosave.test.ts` covers AC-8.

Run AC coverage guard:

```bash
.agents/skills/implement-feature/scripts/check-ac-coverage.sh specs/021-postgresql-prisma-autosave/acceptance.md backend/src
```

Expected: every AC-1 through AC-11 has at least one `@covers AC-n` tag.

Run repo verification:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Manual Smoke Scenario

1. Run backend and frontend:

   ```bash
   pnpm dev:all
   ```

2. Open the same room in two browser tabs.
3. Draw or move an element.
4. Confirm the second tab updates immediately.
5. Wait at least 5 seconds, then inspect PostgreSQL:

   ```sql
   select id, "documentClock" from "Room";
   select "recordId", "recordClock", state from "Record";
   ```

6. Delete the element, wait for autosave or close both tabs, then inspect:

   ```sql
   select "recordId", "deletedClock" from "Tombstone";
   ```

Expected: active elements live in `Record`; deleted elements live in `Tombstone`; the room clock
only increases once per flushed batch.
