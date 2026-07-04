# Phase 3.30: P3C-00 Re-render isolation - Context

## Source And Mapping

- Repo roadmap ID: `P3C-00`
- GSD phase: `3.30`
- Canonical source: `docs/SPECS.md` section `[P3C-00]`
- Acceptance registry: `specs/041-p3c-00-rerender-isolation/acceptance.md`

## Locked Decisions

- P3C remains SVG-only. This phase must not introduce a Canvas overlay or a second render engine.
- Scope is limited to render isolation needed before freehand/highlighter/eraser tools.
- `Whiteboard.tsx` must stop reading point-heavy draft state directly.
- Draft rendering and draft-dependent overlays may subscribe to draft state in child components.
- Committed element rendering must be memoized at the layer and per-shape wrapper level so draft point
  updates do not invoke render functions for unchanged committed shapes.
- Existing move/resize draft semantics are preserved: the committed element copy is hidden while the
  draft copy and selection overlay reflect draft bounds.

## Non-goals

- Do not add freehand, highlighter, or eraser tools in this phase.
- Do not change realtime, persistence, sync contracts, or the mutation pipeline.
- Do not add new dependencies.

## Acceptance Mapping

- `AC-1`: Whiteboard draft subscription removal.
- `AC-2`: Committed shape render isolation under draft point updates.
- `AC-3`: Existing draft copy and selection overlay behavior preserved.

## Runtime Note

This plan is executed inline because Codex subagent spawning is only allowed when the user
explicitly requests subagents. The GSD artifact gates, AC registry, and verification mapping remain
binding.
