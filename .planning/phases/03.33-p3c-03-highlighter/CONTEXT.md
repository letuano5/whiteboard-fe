# Phase 3.33: P3C-03 Highlighter - Context

## Source And Mapping

- Repo roadmap ID: `P3C-03`
- GSD phase: `3.33`
- Canonical source: `docs/SPECS.md` section `[P3C-03]`
- Acceptance registry: `specs/047-p3c-03-highlighter/acceptance.md`

## Locked Decisions

- Highlighter ink remains SVG-only and uses the highlighter shape util registered in P3C-01.
- Highlighter pointer samples are world-coordinate points and are stored in `Element.props.points`.
- Highlighter creation uses the same frontend mutation pipeline as freehand creation so local
  persistence, realtime sync, undo/redo, move, delete, and eraser behavior stay on existing paths.
- The highlighter drawing implementation should reuse the existing freehand point helper pipeline
  for point simplification, bounds derivation, distinct-point filtering, and point-cap splitting.
- Highlighter defaults are MVP-level fixed styling: wider than freehand and semi-transparent. No
  blend mode, SVG filter, multiply compositing, or Canvas overlay is required.
- The toolbar exposes highlighter as an editing tool. Switching tools clears transient draft state.

## Non-goals

- Do not add highlighter-specific blend modes, filters, or pixel compositing.
- Do not add a Canvas or 2D context render path.
- Do not change backend persistence schemas or P5 sync contracts.
- Do not change eraser semantics; P3C-04 already owns whole-element erasing.

## Acceptance Mapping

- `AC-1`: toolbar/pointer flow creates committed `highlighter` elements through the existing
  mutation pipeline and SVG ink renderer.
- `AC-2`: committed highlighter elements carry fixed semi-transparent, wider-than-freehand props.
- `AC-3`: highlighter drawing uses the same simplification and cap-splitting helpers as freehand.
- `AC-4`: toolbar access and tool switching cover the highlighter tool.

## Runtime Note

This phase is executed inline because subagent dispatch was not explicitly requested. The GSD
artifact gates, AC registry, and verification mapping remain binding.
