# Benchmark Report

Generated at: 2026-07-07T10:25:28.778Z

## How to run

```bash
pnpm benchmark:socket -- --target=http://localhost:3001 --scenario=hot-room --clients-per-room=10 --duration=10
pnpm benchmark:socket -- --target=http://localhost:3001 --scenario=reconnect-diff --clients-per-room=10 --element-count=1000
pnpm benchmark:http -- --target=http://localhost:3001 --concurrency=10,50,100 --auth-token=<token> --room-ids=<room-id>
pnpm benchmark:render -- --target=http://127.0.0.1:5173 --elements=1000,5000,10000 --scenarios=render,pan-zoom
pnpm benchmark:report
```

## Targets

- Backend local: `http://localhost:3001`
- Backend VPS: `https://api.34.46.13.22.nip.io/`
- Frontend local: `http://localhost:5173` or `http://127.0.0.1:5173`
- Frontend GitHub Pages smoke: `https://letuano5.github.io/whiteboard-fe/`

Socket/backend load should target the backend directly. GitHub Pages is for render smoke only.

## Auth And Seed Mode

Socket benchmarks seed local rooms through Prisma when `DATABASE_URL` is available. Seeded rooms use the `bench-*` prefix and `link_edit` visibility so anonymous benchmark sockets can edit without production auth. For VPS runs, pass existing `--room-ids` and `--auth-token` when production auth is required; if production seeding is unavailable, run local seeded mode and document the VPS limitation.

HTTP benchmarks use `--auth-token` for protected routes. Without a token they still run, but protected endpoints are expected to report 401/403/404.

## Socket Results

| Scenario | Target | Clients | Join OK | Access Errors | Ack p95 ms | Reconnect p95 ms | Events/sec |
|---|---:|---:|---:|---:|---:|---:|---:|
| hot-room | http://localhost:3001 | 10 | 10 | 0 | 96.03 | 0 | 30 |
| reconnect-diff | http://localhost:3001 | 10 | 11 | 0 | 742.16 | 26.4 | 818 |
| hot-room | https://api.34.46.13.22.nip.io | 10 | 0 | 10 | 272.22 | 0 | 1 |

## Render Results

| Target | Scenario | Elements | First render ms | Frame p95 ms | Long tasks | SVG nodes |
|---|---:|---:|---:|---:|---:|---:|
| http://127.0.0.1:5173 | render | 1000 | 131.6 | 9 | 0 | 2252 |
| http://127.0.0.1:5173 | pan-zoom | 1000 | 123.6 | 8.6 | 0 | 2252 |
| http://127.0.0.1:5173 | render | 5000 | 278.5 | 9.2 | 0 | 11052 |
| http://127.0.0.1:5173 | render | 10000 | 370.9 | 9.1 | 0 | 22052 |
| http://127.0.0.1:5173 | pan-zoom | 5000 | 236.7 | 17.5 | 0 | 11052 |
| http://127.0.0.1:5173 | pan-zoom | 10000 | 381.5 | 33.4 | 1 | 22052 |

## HTTP Results

| Target | Endpoint | Concurrency | Requests | Error rate | p95 ms | Bytes |
|---|---|---:|---:|---:|---:|---:|
| http://localhost:3002 | /api/documents?limit=24 | 10 | 20 | 0% | 55.05 | 690 |
| http://localhost:3002 | /api/rooms/56d30592-cdf1-4b95-b660-5973098358aa/access | 10 | 20 | 0% | 17 | 7690 |
| http://localhost:3002 | /api/rooms/56d30592-cdf1-4b95-b660-5973098358aa/export-native | 10 | 20 | 0% | 15.68 | 5750 |
| http://localhost:3002 | /api/rooms/56d30592-cdf1-4b95-b660-5973098358aa/snapshots | 10 | 20 | 0% | 25.86 | 50 |

## Limits And Bottlenecks

- Ramp high socket loads with `--ramp=10,50,100,1000,10000`; stop automatically when the join/error rate exceeds `--stop-error-rate`.
- 1k and 10k socket clients are supported by the harness, but should only be run after the 10/50/100 smoke levels pass on the target machine.
- Render benchmark measures SVG/DOM cost in Chromium. It does not replace manual UX inspection for selection/toolbar behavior.
- HTTP runner focuses on important GET endpoints and intentionally avoids destructive document mutations.

## Recommendations

- Keep a small committed smoke baseline in `benchmark-results/` after meaningful sync/render changes.
- Run `reconnect-diff` before changing tombstone, diff, or room epoch code.
- Run render 1k/5k/10k before adding new SVG shape rendering behavior.
