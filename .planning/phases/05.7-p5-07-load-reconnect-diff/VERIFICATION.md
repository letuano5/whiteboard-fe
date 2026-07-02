# Verification: Phase 5.7 P5-07 Load, reconnect & diff

## Automated Checks

- `node .codex/gsd-core/bin/gsd-tools.cjs query init.plan-phase 5.7` - passed; phase found with context and plan.
- `.agents/skills/implement-feature-gsd/scripts/check-ac-coverage.sh specs/036-p5-07-load-reconnect-diff/acceptance.md .` - passed; all 8 ACs covered.
- `pnpm typecheck` - passed.
- `pnpm test` - passed: backend 198 tests, frontend 604 tests.
- `pnpm lint` - passed.
- `pnpm --filter whiteboard-fe exec prettier --check <P5-07 changed files>` - passed.

## Format Note

- Root `pnpm format:check` still fails in this workspace because the root script calls `prettier`
  directly while the binary is installed under `frontend`; running via `whiteboard-fe` works.
- Whole-repo `prettier --check ..` also reports many pre-existing formatting warnings in `.codex`,
  `.agents`, `dist`, old specs, and unrelated docs. The P5-07 changed files pass the targeted check.

## Acceptance Coverage

- AC-1: Covered by P5 snapshot contract emission and frontend snapshot hydration tests.
- AC-2: Covered by backend `ROOM_DIFF` payload tests.
- AC-3: Covered by reconnect request payload tests with `lastServerClock`, `roomEpoch`, and pending IDs.
- AC-4: Covered by pending request status contract/handler tests.
- AC-5: Covered by wipe-all snapshot tests for stale history/replace-boundary behavior.
- AC-6: Covered by repository slot clock filtering test.
- AC-7: Covered by frontend snapshot/diff clock update and known slot clock tests.
- AC-8: Covered by frontend slot-aware diff apply test without `originRequestIds`.
