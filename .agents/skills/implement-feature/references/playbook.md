# Detailed Playbook

Use this reference when a phase needs more detail than the main `SKILL.md`.

## Phase 0

Bootstrap once per repo:

1. If `.specify/memory/constitution.md` still has template placeholders, run or follow
   `$speckit-constitution` with `AGENTS.md` as repo context.
2. Confirm the Codex Stop hook is configured in `.codex/hooks.json`. It only acts on
   thread-local state created by `.codex/hooks/implement_feature_stop.py --start`, using
   `CODEX_THREAD_ID` to avoid cross-thread interference. Runtime state is stored in the
   ignored `.implement-feature-state/` directory.
3. Offer the AC coverage pre-commit guard only after asking the user. A hook writes into
   `.git/hooks/`, so it must be explicit.

Recommended hook body:

```bash
exec .agents/skills/implement-feature/scripts/check-ac-coverage.sh
```

## Phase 1

For pinned feature IDs, read the relevant `docs/SPECS.md` blocks directly:

```bash
grep -A 100 "\[P2.5-02\]" docs/SPECS.md
grep -A 100 "\[P2.5-03\]" docs/SPECS.md
```

If no pinned item is provided, survey `docs/`, `specs/`, root markdown files, and relevant
code comments to identify the intended feature. Do not edit files during this survey.

Run this once the feature identity is known:

```bash
.codex/hooks/implement_feature_stop.py --start "<feature name or ID>"
```

Run `$speckit-clarify` only when at least one trigger applies:

1. Acceptance cannot be enumerated as discrete, checkable `AC-n`.
2. The item uses vague unquantified terms such as "fast", "reasonable", "flexible", or
   similar wording that affects tests.
3. Concrete input, expected output, boundary conditions, or error behavior are missing.
4. Multiple plausible interpretations would produce different tests.
5. The item conflicts with the data model or another part of `docs/SPECS.md`.
6. It depends on an architecture/style decision not settled in `AGENTS.md` or constitution.

Build `acceptance.md` after `spec.md` is settled:

```markdown
# Acceptance Criteria

AC-1: <criterion text>
AC-2: <criterion text>
```

When `spec.md` changes later, reconcile by appending. Never renumber or repurpose existing
AC IDs.

## Phase 2

Read `AGENTS.md` and config files such as package manifests, lockfiles, ESLint, Vite,
Tailwind, and tsconfig files. Research only new high-churn APIs or libraries that are not
already documented in repo context. Durable decisions go into `AGENTS.md`.

## Phase 3

Generate planning artifacts before asking to start code edits:

1. `$speckit-plan`
2. `$speckit-tasks`
3. `$speckit-analyze`

Instruct task generation to include one acceptance-test task per `AC-n`, with oracle text
coming from `acceptance.md`/`spec.md`, not from code.

If analysis finds issues, fix by updating or regenerating the affected upstream artifact.
Do not quietly hand-patch generated files in a way the next regeneration will erase.

If the user rejects the plan:

- Revise: keep `specs/<feature>/`, update/regenerate affected artifacts, re-run analysis,
  then present the gate again.
- Abandon: remove just-created artifacts only after explicit confirmation.

Before waiting on user approval, run:

```bash
.codex/hooks/implement_feature_stop.py --awaiting-user "plan approval"
```

When the user approves and implementation resumes, run:

```bash
.codex/hooks/implement_feature_stop.py --resume
```

After approval, keep the main thread as the conductor and delegate Phase 4-7:

1. Read `references/impl-agent-prompt.md`.
2. Fill `$SPEC_DIR`, `$FEATURE_NAME`, and `$ARTIFACTS_REGENERATED`.
3. Spawn a Codex worker subagent when the current surface supports subagents.
4. Pass only the filled prompt plus the approved artifact paths. Let the worker read code,
   run focused tests, and handle verbose implementation context in its own window.
5. If subagents are unavailable, follow the same prompt in the main thread as a fallback.
6. When the worker returns, scan for `NEED USER INPUT:` before summarizing. If present,
   ask the user in Vietnamese, update/regenerate upstream artifacts if needed, re-run
   `$speckit-analyze`, then re-spawn or resume the worker with the updated context.

## Phase 4

Implementation normally runs in the worker subagent so file reads, test logs, and local
debugging do not pollute the conductor context. If no subagent mechanism is available,
continue in the main thread with the same constraints.

Follow `tasks.md` in dependency order. The checkbox is only a mirror: the real completion
signal is code slice present plus relevant verification passing.

Deviation handler:

1. Stop coding when the plan is wrong, incomplete, or infeasible.
2. Run `.codex/hooks/implement_feature_stop.py --awaiting-user "<plan decision>"`.
3. Explain the plan issue and ask the user for the decision in Vietnamese.
4. On approval, run `.codex/hooks/implement_feature_stop.py --resume`, update/regenerate
   `plan.md` and `tasks.md`, reconcile `acceptance.md` if
   requirement text changed, and run `$speckit-analyze`.
5. Resume implementation from the updated artifacts.

Never write off-plan code first and update the plan afterward.

## Phase 5

Layer 1 acceptance tests are primary:

- Each `AC-n` has at least one test tagged `@covers AC-n`.
- Expected values come from criterion text.
- Run `check-ac-coverage.sh` against the active `acceptance.md`.

Layer 2 robustness tests harden the implementation:

- Empty/null/undefined values
- Numeric and collection boundaries
- Malformed input
- Unicode/special characters where relevant
- I/O, permission, timeout, and network errors
- Concurrency/race and idempotency
- Conditional branches and error paths

## Phase 6

Read `commit-convention.md` and recent git history. Draft a commit message only; do not
stage or commit.

## Phase 7

Before handoff:

- Run `$speckit-analyze` if Spec Kit artifacts changed.
- Run `check-ac-coverage.sh`.
- Run relevant repo verification commands.

Report in Vietnamese with changed files, tests, AC coverage, technical decisions, remaining
TODOs, and the commit message.

After the report is complete, run:

```bash
.codex/hooks/implement_feature_stop.py --finish
```
