---
name: implement-feature
description: >-
  Implement a feature end-to-end from docs/SPECS.md, Spec Kit artifacts,
  acceptance criteria, task files, tests, and Vietnamese handoff. Use when the
  user asks Codex to implement a feature, add/build functionality from a spec,
  continue a Spec Kit workflow, preserve AC-n acceptance criteria, generate/run
  tests, or produce a commit-message handoff. Explicit invocation:
  $implement-feature or selection from /skills.
---

# Implement Feature

Run a spec-first feature workflow for this repo. User-facing output is Vietnamese. Code,
comments, identifiers, and commit messages follow the repository convention in
`AGENTS.md`.

## Load First

1. Read `AGENTS.md`. If it is missing, read `CLAUDE.md` as legacy fallback only.
2. Read `docs/SPECS.md` for scope, phases, and feature IDs.
3. If the feature already has `specs/<feature>/`, read `spec.md`, `acceptance.md`,
   `plan.md`, and `tasks.md` before deciding what to generate.
4. Open references only as needed:
   - `references/speckit.md` for Spec Kit skill/command mapping.
   - `references/playbook.md` for phase details and deviation handling.
   - `references/impl-agent-prompt.md` after Phase 3 artifacts are ready to delegate
     Phase 4-7 to a Codex worker subagent, or to prepare the new-session handoff when
     subagents are unavailable.
   - `references/commit-convention.md` before drafting the final commit message.

## Hard Rules

1. Never guess important product behavior. If a decision affects scope, UX, data shape,
   architecture, or tests, ask the user directly in Vietnamese and wait.
2. Keep spec/plan upstream and code/tests downstream. If implementation reveals the plan is
   wrong, stop coding, propose a plan change, regenerate or update upstream artifacts, then
   resume. Never retrofit `plan.md` to justify code already written.
3. `acceptance.md` is an append-only AC registry. Existing `AC-n` IDs are immutable; append
   new criteria as higher numbers.
4. Acceptance tests use the criterion text as the oracle, not the current code output. Tag
   each covering test with `@covers AC-n`.
5. Do not call `$speckit-implement`. Implement by hand from `tasks.md`.
6. Do not run `git add` or `git commit`; return a commit message in a code block.
7. Preserve user changes in the working tree. Do not delete or rewrite unrelated artifacts.
8. A normal `$implement-feature` invocation is explicit authorization to run the whole
   feature workflow end-to-end. Do not stop for a plan approval gate unless the user
   explicitly asks for plan-only/gated mode with wording such as "plan only", "do not code
   yet", "wait for approval", or the Vietnamese equivalents. Still stop for genuine
   blockers under rule 1.

## Codex Behavior Differences From Claude

- This repo has a Codex `Stop` hook at `.codex/hooks.json` with implementation in
  `.codex/hooks/implement_feature_stop.py`. It is intentionally scoped by
  `CODEX_THREAD_ID`, so only the Codex thread that started `$implement-feature` can be
  nudged to continue. Other chat/analysis threads in the same repo should see no active
  state. Runtime state lives in ignored `.implement-feature-state/<CODEX_THREAD_ID>.json`
  rather than in `.codex/`, because `.codex/` can be protected by the sandbox.
- Do not use Claude-only `AskUserQuestion`, `EnterPlanMode`, `ExitPlanMode`, `Agent`, or
  global stop-hook calls. Ask directly in chat; when approval is needed, present a clear
  text gate. If Codex plan mode is available, use `/plan` for the approval discussion, but
  generate Spec Kit artifacts before any read-only planning gate.
- Default to a conductor/worker split. The main Codex thread owns Phases 0-3, user gates,
  plan-deviation decisions, and final handoff. In normal full-flow mode, Phase 3 is an
  internal checkpoint, not a user approval gate. After artifacts exist and analysis passes
  or is resolved, spawn a Codex worker subagent for Phases 4-7 when the current Codex
  surface supports subagents.
- If a worker subagent cannot be spawned, do not default to implementing Phase 4-7 in the
  conductor thread. Create a new Codex session/thread handoff for Phase 4-7 with a complete
  prompt and artifact paths. Use main-thread implementation only when the user explicitly
  asks to keep working in the current thread.
- Keep the main thread lean. Pass the worker only the feature name, spec directory,
  regenerated-artifacts flag, approved artifacts, and `references/impl-agent-prompt.md`.
  The worker reads implementation files and noisy test output in its own context, then
  returns a compact Vietnamese report or a `NEED USER INPUT:` blocker.

## Continuation State

At the beginning of the workflow, run:

```bash
.codex/hooks/implement_feature_stop.py --start "<feature name or ID>"
```

When advancing phases, optionally update the phase hint:

```bash
.codex/hooks/implement_feature_stop.py --phase "Phase 3 - artifacts and analysis"
```

Before asking the user a blocking question or waiting at an approval gate, run:

```bash
.codex/hooks/implement_feature_stop.py --awaiting-user "<decision needed>"
```

After the user answers and the workflow resumes, run:

```bash
.codex/hooks/implement_feature_stop.py --resume
```

After the final handoff is complete, always run:

```bash
.codex/hooks/implement_feature_stop.py --finish
```

If the hook is unavailable, continue normally and mention in the handoff that automatic
continuation was not active.

## Spec Kit Detection

Spec Kit mode is available when `.specify/` exists and Codex Spec Kit skills exist under
`.agents/skills/speckit-*`. Claude skills under `.claude/skills` may also exist; leave them
untouched.

If Codex can invoke skills directly, use `$speckit-specify`, `$speckit-clarify`,
`$speckit-plan`, `$speckit-tasks`, `$speckit-analyze`, `$speckit-checklist`, and
`$speckit-constitution` by their Codex skill names. If the current Codex surface cannot
directly invoke a skill, read the matching `.agents/skills/speckit-*/SKILL.md` and follow
its scripts/templates explicitly, usually through `.specify/scripts/bash/*`.

If Spec Kit is absent, explain that to the user in Vietnamese and fall back to a plain
spec digest -> plan -> code -> tests handoff while preserving the hard rules.

## Workflow

### Phase 0 - Bootstrap

- If `.specify/memory/constitution.md` still contains placeholders, run or follow
  `$speckit-constitution` using `AGENTS.md` as repository context.
- Offer to install the AC coverage guard as a pre-commit hook only after asking the user,
  because it writes `.git/hooks/`.
- See `references/playbook.md#phase-0`.

### Phase 1 - Specs

- If the user provides feature IDs in brackets, such as `[P2.5-02,P2.5-03]`, grep those
  blocks from `docs/SPECS.md` and use the combined result. If any ID is missing or
  unclear, ask the user.
- If an existing `specs/<feature>/spec.md` and `acceptance.md` already cover the feature,
  read them and skip regeneration.
- Otherwise run or follow `$speckit-specify`, then run `$speckit-clarify` only when the
  item is ambiguous by the criteria in `references/playbook.md`.
- Create or reconcile `specs/<feature>/acceptance.md`: one `AC-n:` per acceptance
  criterion. Reconcile by appending only.

Gate: finalized `spec.md` plus append-only `acceptance.md`.

### Phase 2 - Docs Research

Read `AGENTS.md` and existing config files first. Skip docs research by default. Research
only when the feature uses a library/API that is both undocumented in `AGENTS.md` and
high-churn or version-sensitive. Record durable repo conventions in `AGENTS.md`, not
`CLAUDE.md`; use `CLAUDE.md` only as a legacy shim.

### Phase 3 - Plan And Approval

Generate artifacts before implementation:

1. If `plan.md` exists, read it; otherwise run or follow `$speckit-plan` with `AGENTS.md`
   and any Phase 2 notes as context.
2. If `tasks.md` exists, read it; otherwise run or follow `$speckit-tasks` and require one
   acceptance-test task per `AC-n`.
3. Always run or follow `$speckit-analyze` after tasks exist.
4. Surface critical findings only when they need user input. Fix ordinary artifact
   inconsistencies by regenerating/updating upstream artifacts before implementation.
5. In normal full-flow mode, do not present a plan approval gate. The original
   `$implement-feature` request already authorizes proceeding through code and tests.
6. In explicit plan-only/gated mode, present a concise Vietnamese approval gate pointing to
   `spec.md`, `acceptance.md`, `plan.md`, and `tasks.md`; then wait before source-code edits.

If the plan is rejected, ask whether to revise or abandon. Never delete `specs/<feature>/`
without explicit confirmation.

When Phase 3 is complete in full-flow mode, or after approval in explicit gated mode:

1. If resuming from an explicit user gate, run `.codex/hooks/implement_feature_stop.py --resume`.
2. Read `references/impl-agent-prompt.md`.
3. Fill `$SPEC_DIR`, `$FEATURE_NAME`, and `$ARTIFACTS_REGENERATED`.
4. Spawn a Codex worker subagent for Phases 4-7 when available, and wait for its result.
5. If subagents are unavailable, create a new Codex session/thread handoff for Phases 4-7
   using the filled worker prompt and artifact paths. Do not continue in the conductor
   thread unless the user explicitly asked for that fallback.
6. If the worker returns `NEED USER INPUT:`, surface the blocker to the user in Vietnamese,
   update/regenerate upstream artifacts if the decision changes the plan, re-run
   `$speckit-analyze`, then re-spawn or resume the worker.

### Phase 4 - Implementation

Implementation normally runs in the worker subagent or the newly created Phase 4-7 session.
Implement manually from `tasks.md` in dependency order:

- Do not redo repository discovery that the Spec Kit phases already performed.
- Read only the approved artifacts, files named by `tasks.md`/`plan.md`, and at most 2-3
  directly related neighboring files before editing.
- Do not run broad repository searches unless `tasks.md` lacks a target path or a local
  import/API cannot be resolved from the target files.
- Code conforms to `plan.md`.
- After each meaningful slice, run the smallest relevant verification.
- Tick `tasks.md` checkboxes only after code exists and the related verification passes.
- If the plan is infeasible, stop and use the deviation handler in `references/playbook.md`.

### Phase 5 - Tests

Implement Layer 1 acceptance tests from `acceptance.md`, tagging every criterion with
`@covers AC-n`. Then add robustness tests for edge cases. Run:

```bash
.agents/skills/implement-feature/scripts/check-ac-coverage.sh specs/<feature>/acceptance.md <test-path>
```

Run the repo's relevant test/typecheck/lint commands. Fix code or the test oracle only
when the oracle was misread from the AC text.

### Phase 6 - Commit Message

Read `references/commit-convention.md`, inspect recent repo history if needed, and draft a
commit message only. Do not stage or commit.

### Phase 7 - Handoff

Run final consistency checks:

- `$speckit-analyze` when Spec Kit artifacts changed.
- `check-ac-coverage.sh` for the active `acceptance.md`.
- Relevant package tests/typechecks.

Report in Vietnamese:

- Đã làm gì.
- Test nào pass and how many AC-n are covered.
- Files changed.
- Remaining TODOs or blockers.
- Commit message in a code block.
