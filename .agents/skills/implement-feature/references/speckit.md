# Spec Kit Integration Reference

Spec Kit keeps `spec.md`, `plan.md`, and `tasks.md` aligned so implementation flows from
approved requirements. This skill adds stricter acceptance criteria and test coverage rules.

## Preconditions

Spec Kit mode is available when:

- `.specify/` exists, and
- Codex skills exist under `.agents/skills/speckit-*`.

Claude skills under `.claude/skills/speckit-*` may coexist for Claude Code. Do not remove
or edit them as part of Codex workflow migration.

## Codex Skill Map

Use these names when Codex can invoke skills directly:

| Skill | Purpose | Writes |
| --- | --- | --- |
| `$speckit-constitution` | Project principles and architecture | `.specify/memory/constitution.md` |
| `$speckit-specify` | Feature WHAT/WHY | `specs/<feature>/spec.md` |
| `$speckit-clarify` | Clarify unclear requirements | updates `spec.md` |
| `$speckit-plan` | Technical design | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| `$speckit-tasks` | Executable task list | `tasks.md` |
| `$speckit-analyze` | Read-only consistency analysis | report only |
| `$speckit-checklist` | Requirements-writing quality gate | checklist artifacts |
| `$speckit-converge` | Append remaining work against existing artifacts | appends to `tasks.md` |
| `$speckit-implement` | Auto-executes tasks | source edits |

Do not use `$speckit-implement` for this workflow. Implement manually to preserve approval
and deviation gates.

Use `$speckit-converge` only for resume situations where code is on-plan but incomplete.
Do not use it to legitimize off-plan code or restore checkbox state after regeneration.

## When Direct Skill Invocation Is Not Available

Read the matching `.agents/skills/speckit-*/SKILL.md` and perform the described steps
directly. The official Spec Kit skills usually call scripts under `.specify/scripts/bash/*`
and use templates under `.specify/templates/*`.

Common script entrypoints:

- `.specify/scripts/bash/setup-plan.sh --json`
- `.specify/scripts/bash/setup-tasks.sh --json`
- `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`

Prefer the Codex skill docs when present; fall back to scripts only when skill invocation is
not exposed in the current Codex surface.

## Agent Context File

This repo uses `AGENTS.md` as the shared agent context file. The Spec Kit agent-context
extension should manage its `<!-- SPECKIT START --> ... <!-- SPECKIT END -->` block there,
not in the `CLAUDE.md` shim.

If a generated Spec Kit skill still says it updates `CLAUDE.md`, treat that as a legacy
instruction and use `.specify/extensions/agent-context/agent-context-config.yml` to confirm
the actual configured context file.

## Artifact Rules

- `spec.md` and `plan.md` are upstream. Code and tests are downstream.
- `tasks.md` is generated from the spec and plan. Avoid hand-appending acceptance-test
  tasks; regenerate/update upstream artifacts when the generator must change.
- `acceptance.md` is owned by this skill, not by Spec Kit. Maintain it as an append-only
  registry of `AC-n:` IDs.
- `speckit-analyze` is read-only; use it after `tasks.md` exists and before coding.
- `speckit-checklist` is a spec-quality gate, not an implementation-completeness check.

## Codex Stop Hook

Codex has a project-local `Stop` hook in `.codex/hooks.json`. It is not global workflow
state. The hook reads `.implement-feature-state/<CODEX_THREAD_ID>.json`, so another Codex
thread in the same repo will not continue an active implementation unless it is the same
resumed thread.

The conductor thread must explicitly run `--start`, `--awaiting-user`, `--resume`, and
`--finish` on `.codex/hooks/implement_feature_stop.py` at the phase boundaries described
in `SKILL.md`. A Phase 4-7 worker subagent should not mutate continuation state; it returns
a compact report or `NEED USER INPUT:` marker to the conductor.
