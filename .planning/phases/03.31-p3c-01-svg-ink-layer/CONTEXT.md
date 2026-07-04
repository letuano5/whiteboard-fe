# Phase 3.31: P3C-01 SVG ink layer - Context

## Source And Mapping

- Repo roadmap ID: `P3C-01`
- GSD phase: `3.31`
- Canonical source: `docs/SPECS.md` section `[P3C-01]`
- Acceptance registry: `specs/042-p3c-01-svg-ink-layer/acceptance.md`

## Locked Decisions

- P3C ink remains SVG-only. This phase must not introduce a Canvas overlay, a 2D context renderer,
  or any `ctx.setTransform` path for freehand/highlighter.
- Freehand and highlighter committed elements render through the existing shape registry used by
  `ElementLayer`, `DraftLayer`, and `RemoteDraftLayer`.
- Ink points remain in world coordinates. The existing `<g transform="scale(...) translate(...)">`
  in `SvgLayer` applies the shared camera transform for ink exactly as it does for other shapes.
- Scope is limited to rendering/imported/synced committed ink elements that already exist in
  element state. Drawing tools, point simplification, point caps, highlighter-specific styling
  controls, and eraser behavior belong to later P3C phases.
- Shared type comments should reflect the current SVG-only P3C architecture from `docs/SPECS.md`
  v0.5.

## Non-goals

- Do not add toolbar buttons or pointer drawing behavior for freehand/highlighter.
- Do not add new dependencies such as `perfect-freehand`.
- Do not change backend sync contracts or persistence schemas.
- Do not implement eraser behavior in this phase.

## Acceptance Mapping

- `AC-1`: shape registry and SVG layer render both `freehand` and `highlighter` as SVG nodes with
  no Canvas render path.
- `AC-2`: rendered ink points stay in world-space coordinates under the existing camera-transformed
  parent SVG group.

## Runtime Note

This plan is executed inline because Codex subagent spawning is only allowed when the user
explicitly requests subagents. The GSD artifact gates, AC registry, and verification mapping remain
binding.
