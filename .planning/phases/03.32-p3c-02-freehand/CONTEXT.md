# Phase 3.32: P3C-02 Freehand - Context

## Source And Mapping

- Repo roadmap ID: `P3C-02`
- GSD phase: `3.32`
- Canonical source: `docs/SPECS.md` section `[P3C-02]`
- Acceptance registry: `specs/043-p3c-02-freehand/acceptance.md`

## Locked Decisions

- Freehand ink remains SVG-only and uses the freehand shape util registered in P3C-01.
- Pointer samples are world-coordinate points and are stored in `Element.props.points`.
- Freehand commits use the same frontend mutation pipeline as other element creation so local
  persistence, realtime sync, undo/redo, move, and delete stay on the existing path.
- Raw samples are simplified before they become committed element points and before path generation.
  A local Douglas-Peucker-style simplifier is sufficient; no new drawing dependency is required.
- The per-shape point ceiling is a frontend constant close to the tldraw reference scale from the
  SRS. Use `MAX_POINTS_PER_FREEHAND_STROKE = 600` unless existing local constraints require a lower
  value in tests.
- When the cap is exceeded during one pointer drag, commit the current stroke and continue sampling
  into a new stroke without requiring the user to release and press again.

## Non-goals

- Do not implement highlighter drawing controls; P3C-03 owns highlighter behavior.
- Do not implement eraser behavior; P3C-04 owns eraser behavior.
- Do not add a Canvas or 2D context render path.
- Do not change backend persistence schemas or P5 sync contracts.

## Acceptance Mapping

- `AC-1`: toolbar/pointer flow creates committed freehand elements through the existing element
  store and resulting elements can be moved/deleted by existing tools.
- `AC-2`: point simplification reduces raw samples before SVG path data is generated.
- `AC-3`: long pointer drags split into multiple committed `freehand` elements at the configured
  point ceiling.

## Runtime Note

This phase is executed inline because subagent dispatch was not explicitly requested. The GSD
artifact gates, AC registry, and verification mapping remain binding.
