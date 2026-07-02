# Verification: Phase 5.8 P5-08 Delete, tombstone & binding repair

## Planned Checks

- [x] `pnpm --filter whiteboard-be test -- sync-room-delete-binding-repair`
- [x] `.agents/skills/implement-feature-gsd/scripts/check-ac-coverage.sh specs/037-p5-08-delete-tombstone-binding-repair/acceptance.md backend/src/sync/sync-room-delete-binding-repair.test.ts`
- [x] `pnpm --filter whiteboard-be test -- sync-room`
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm --dir frontend exec prettier --check ../backend/src/sync/sync-room-planner.ts ../backend/src/sync/sync-room-delete-binding-repair.test.ts ../specs/037-p5-08-delete-tombstone-binding-repair/acceptance.md ../.planning/phases/05.8-p5-08-delete-tombstone-binding-repair/05.8-01-PLAN.md ../.planning/phases/05.8-p5-08-delete-tombstone-binding-repair/CONTEXT.md ../.planning/phases/05.8-p5-08-delete-tombstone-binding-repair/VERIFICATION.md`

## AC Coverage

- [x] AC-1 covered by delete-bound-target test.
- [x] AC-2 covered by full-slot-patch peer-state test.
- [x] AC-3 covered by tombstone resurrection rejection test.
- [x] AC-4 covered by limit/atomicity tests.
- [x] AC-5 covered by target transform repair test.
- [x] AC-6 covered by concurrent terminal binding update test.
- [x] AC-7 covered by missing/deleted binding target validation test.
- [x] AC-8 covered by tombstoned delete rejection and retry replay test.

## Notes

- Root `pnpm format:check` is currently blocked because the root workspace does not install a
  `prettier` binary. Targeted Prettier verification was run through the frontend workspace binary.
