# Research: Multi-select + Duplicate/Copy-Paste (P2-08)

**Date**: 2026-06-27

## Summary

No external library or API research required. All technology is already established in CLAUDE.md and the existing codebase. Decisions below are derived from the existing code survey.

## Decisions

### Decision 1: Batch History Entry for Multi-shape Mutations

**Decision**: Add `createElements(drafts: ElementDraft[])` to mutation-pipeline.ts that emits a single `MutationEvent` for all created elements.

**Rationale**: The history capture hook (`history-capture.ts`) listens per `MutationEvent`. One event = one undo step. `updateElements` already does this for updates; `createElements` extends the pattern for batch creates (duplicate / paste).

**Alternatives considered**:
- Call `createElement` N times (N undo steps) — rejected because AC-10 / FR-010 require one undo step per operation.
- Manual `useHistoryStore.getState().push(...)` from the tool code — rejected because it bypasses the registered hook and breaks any future hook extensions.

### Decision 2: Clipboard Storage — Interaction Store

**Decision**: Store clipboard in `interaction.store.ts` as `clipboard: Element[] | null`.

**Rationale**: Clipboard is transient UI state (not committed element data), so it belongs in the interaction store. Constitution principle VII requires keeping committed vs. transient state separate.

**Alternatives considered**:
- Separate clipboard store — rejected as over-engineering for a single field.
- OS Clipboard API — explicitly out of scope per spec assumption.

### Decision 3: Marquee Hit-test — Bounding Box Intersection

**Decision**: An element is "inside" a marquee if its bounding box (`getBounds` from ShapeUtil) intersects the marquee rectangle, not just if it's fully contained.

**Rationale**: Intersection is more intuitive for tactical boards (partial overlap should select). Matches behavior of Excalidraw and similar tools.

**Alternatives considered**:
- Containment only — rejected because it frustrates selection of large elements that extend outside the drag rectangle.

### Decision 4: Multi-drag — `draftElements` Array

**Decision**: Add `draftElements: Element[]` to interaction store for transient positions during multi-element drag (parallel to existing `draftElement` for single).

**Rationale**: SvgLayer needs to render the transient positions of all dragged elements. The existing `draftElement` (singular) pattern works per element; extending to an array keeps the rendering pattern consistent and avoids mutating the committed store during drag.

**Alternatives considered**:
- Apply offsets directly in SvgLayer based on selectedIds + dragDelta — rejected because it requires passing the delta down as a prop, coupling SvgLayer more tightly to drag state.

### Decision 5: Multi-select Visual — Union Bounding Box, No Handles

**Decision**: When `selectedIds.length > 1`, render only a blue dashed rect around the union bounding box. No resize or rotate handles.

**Rationale**: Resize/rotate for a multi-selection requires proportional scaling across heterogeneous shapes (different angles, aspect ratios) — out of scope for P2-08. The bounding box rect is sufficient for visual feedback.
