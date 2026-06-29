# Implementation Plan: Point-Based Model for Linear Elements

**Branch**: `feat/online-room` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/020-linear-point-model/spec.md`

## Summary

Arrow and line elements currently store bounding-box fields (`x,y,width,height`) independently from
`props.points`, causing divergence. This plan eliminates that divergence by: (1) deriving `getBounds`
purely from `props.points`, (2) normalising `x,y,width,height` at every mutation commit,
(3) replacing 8 bbox handles with 2 endpoint handles in the selection overlay, and
(4) making bound arrows follow dragged shapes in real-time during the draft phase.

## Technical Context

**Language/Version**: TypeScript 6.x, React 19.x (frontend only)

**Primary Dependencies**: Zustand 5.x (state), React + SVG (rendering). No new packages.

**Storage**: No storage changes. `Element` schema is unchanged — `x,y,width,height` become
a derived-but-stored cache. Existing elements are normalised on first mutation after deploy.

**Testing**: Vitest 4.x. New unit tests for `normalizeLinearBounds` and endpoint-handle interaction.

**Target Platform**: Browser, SVG rendering layer.

**Performance Goals**: `normalizeLinearBounds` is O(n) in points; arrows have exactly 2 points —
constant time in practice.

**Constraints**: No schema migration required. No new state shape keys.

**Scale/Scope**: Touches 8 frontend source files + 2 new test files (`geometry.ts`, `arrow.tsx`, `line.tsx`, `mutation-pipeline.ts`, `interaction.ts`, `interaction.store.ts`, `SvgLayer.tsx`, `select-tool.ts`).

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Unified Element Store — renderer holds no state | ✅ | `normalizeLinearBounds` called at commit time in the pipeline, not in the renderer |
| II | Element Versioning — `version++`, new `versionNonce`, `updatedAt` on every mutate | ✅ | Normalization applied inside `createElement`/`patchElement`/`updateElements` after the version bump — no additional pipeline step needed |
| III | Shared Camera Transform | ✅ | Endpoint handles use world coordinates from `screenToWorld` — same as all other tools |
| IV | ShapeUtil Strategy — no type branching in core | ⚠️ | `SelectionOverlay` in SvgLayer checks `element.type === 'arrow' || 'line'` to switch from bbox-handles to endpoint-handles. This is presentation logic inside the overlay component, not in the mutation pipeline or core render loop — justified because the handle set is intrinsically type-specific and the check is isolated to one component. |
| V | Sync Data Not Renderer | ✅ | `normalizeLinearBounds` result is stored in the Element (data layer). Endpoint handles are transient UI — never serialised. |
| VI | Single Mutation Pipeline | ✅ | All normalization goes through `createElement`/`patchElement`/`updateElements`. Direct store writes are not used. |
| VII | Committed vs Transient State | ✅ | Endpoint drag uses `draftElement` (interaction store) during drag; commits via `patchElement` on pointer-up. Bound-arrow drafts use `draftElements`. |

## Project Structure

### Documentation (this feature)

```text
specs/020-linear-point-model/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (internal — no external API changes)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code

```text
frontend/src/
├── utils/
│   ├── geometry.ts                        ← ADD normalizeLinearBounds
│   └── __tests__/
│       └── linear-bounds.test.ts          ← NEW: tests for normalizeLinearBounds
├── canvas/
│   ├── shapes/
│   │   ├── arrow.tsx                      ← FIX getBounds → derive from props.points
│   │   ├── line.tsx                       ← FIX getBounds → derive from props.points
│   │   └── arrow-binding.ts              ← EXISTING: computeBindingPoint, parseBinding, findNearestSnap (no changes needed)
│   ├── layers/
│   │   └── SvgLayer.tsx                   ← CHANGE SelectionOverlay for arrow/line
│   └── tools/
│       ├── select-tool.ts                 ← ADD endpoint-handle drag + bound-arrow follow
│       └── __tests__/
│           └── endpoint-handle.test.ts    ← NEW: endpoint drag unit tests
├── store/
│   ├── mutation-pipeline.ts               ← ADD normalization after every create/patch/update
│   └── interaction.store.ts              ← UPDATE setResizeHandle type signature
└── types/
    └── interaction.ts                     ← ADD 'ep-start'|'ep-end' to HandleId
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| IV: type check in SelectionOverlay | Arrow/line selection UX is fundamentally different from bbox-based shapes (2 handles vs 8). The overlay must know the type to choose the handle set. | Moving this logic to ShapeUtil would require ShapeUtil to render React interaction handles, coupling shape logic to interaction state — worse than a localised type check. |
