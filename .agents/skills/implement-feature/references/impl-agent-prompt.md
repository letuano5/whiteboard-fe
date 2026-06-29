# Phase 4-7 Worker Prompt

Use this prompt after the user-approved plan is ready. Prefer running it in a Codex worker
subagent so implementation file reads, debug output, and test logs stay out of the
conductor thread. If subagents are unavailable, follow the same instructions in the main
thread as a fallback.

Feature: **$FEATURE_NAME**
Spec directory: `$SPEC_DIR`
Artifacts regenerated this run: `$ARTIFACTS_REGENERATED`

## Read First

1. `$SPEC_DIR/spec.md`
2. `$SPEC_DIR/plan.md`
3. `$SPEC_DIR/tasks.md`
4. `$SPEC_DIR/acceptance.md`
5. `$SPEC_DIR/data-model.md` if present
6. `AGENTS.md`, with `CLAUDE.md` only as legacy fallback if `AGENTS.md` is missing

Do not prioritize `research.md` or `quickstart.md` for implementation; they are supporting
artifacts, not the approved task list.

## Constraints

- User-facing status and handoff are Vietnamese.
- Code follows repo conventions.
- Code conforms to `plan.md`; never change the plan to match already-written code.
- Do not run `git add` or `git commit`.
- The conductor thread owns continuation state. If you are running as a worker subagent,
  do not run `.codex/hooks/implement_feature_stop.py --finish`, `--awaiting-user`, or
  `--resume`; return a compact result to the conductor instead. If this prompt is being
  used as main-thread fallback, follow the hook commands in `SKILL.md`.
- For minor local choices, make a conservative technical decision and report it under
  "Quyết định kỹ thuật".
- For a plan blocker, stop immediately and return:

```text
NEED USER INPUT: <one-sentence blocker and decision needed>
```

If you are a worker subagent, do not ask the user directly. The conductor will surface the
blocker, update upstream artifacts if needed, and re-spawn or resume the worker.

## Implementation

- Work through `$SPEC_DIR/tasks.md` in dependency order.
- Read 2-3 neighboring files before editing to match style.
- After each task, verify the smallest relevant slice.
- Tick a checkbox only when the code slice exists and its verification passes.
- Done means code plus passing `@covers AC-n` tests, not checkbox count.

## Tests

Layer 1 acceptance tests:

- Implement at least one test per `AC-n` in `$SPEC_DIR/acceptance.md`.
- Tag each covering test with `@covers AC-n`.
- Expected values come from the AC text, not from current code output.

Run:

```bash
.agents/skills/implement-feature/scripts/check-ac-coverage.sh $SPEC_DIR/acceptance.md <test-path>
```

Layer 2 robustness tests:

- Add edge cases for null/empty values, boundaries, malformed input, I/O failures,
  concurrency/race conditions, and important error paths when applicable.

## Closing

- Run the relevant test/typecheck/lint commands.
- If `$ARTIFACTS_REGENERATED` is `true`, run or follow `$speckit-analyze`.
- Draft a Conventional Commit message.
- Return a Vietnamese report with: what changed, tests/AC coverage, technical decisions,
  TODOs/blockers, and the commit message.
- If you are a worker subagent, do not run the finish hook command; the conductor runs it
  after the final user-facing handoff. If this is the main-thread fallback, run `--finish`
  only after that handoff is complete.
