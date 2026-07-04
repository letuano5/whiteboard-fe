# Phase 2.51: P2.5-01 Image / background map - Context

## Source And Mapping

- Repo roadmap ID: `P2.5-01`
- GSD phase: `2.51`
- Canonical source: `docs/SPECS.md` section `[P2.5-01]`
- Acceptance registry: `specs/046-image-background/acceptance.md`

## Locked Decisions

- Image elements use the existing shared `Element` model with `type: 'image'` and `props.src`.
- Rendering must use SVG `<image>` inside the existing shared-camera SVG layer. No Canvas render
  path is introduced for images.
- Image insertion supports both URL input and local file upload converted to a data URL.
- Inserted images are committed immediately through the existing mutation pipeline and selected for
  follow-up manipulation.
- "Background" insertion means the image's `zIndex` is lower than every currently visible element.
- Move and resize behavior must reuse the existing select tool/mutation pipeline; this phase should
  not add image-specific drag or resize machinery.

## Non-goals

- Do not add object storage, asset metadata management, image authentication, or server upload.
- Do not change backend persistence schemas; existing element persistence stores `props.src`.
- Do not implement image cropping, aspect-ratio locking, filters, or external asset proxying.
- Do not alter later P5 sync contracts beyond carrying ordinary element patches.

## Acceptance Mapping

- `AC-1`: URL insertion creates a committed `image` element and the registered ShapeUtil renders
  SVG `<image>`.
- `AC-2`: file upload insertion creates a committed `image` element with a data URL and renders SVG
  `<image>`.
- `AC-3`: image hit-test/bounds plus existing select move/resize code update image bounds through
  mutation events.
- `AC-4`: image insertion sends the created element behind existing visible elements.

## Runtime Note

This plan is executed inline because Codex subagent spawning is only used when explicitly requested
or required. The GSD artifact gates, append-only AC registry, and verification mapping remain
binding.
