# Research: Detail Panel & Basic Toolbar (P1A-07 + P1A-08)

**Date**: 2026-06-24

## Summary

No NEEDS CLARIFICATION items. All technical choices were already established by prior phases (P1A-04/05, CLAUDE.md, constitution). This document records the confirmed findings.

---

## Finding 1 — Pointer Event Containment

**Decision**: Use `onPointerDown={(e) => e.stopPropagation()}` on the detail panel's root `<div>`.

**Rationale**: Prevents pointer events from bubbling to the SVG canvas, which would trigger deselection via the canvas's `handlePointerDown`. This is the simplest solution that doesn't require adding a new event handler in Whiteboard.tsx.

**Alternatives considered**: `pointer-events: none` on the canvas while panel is open — rejected because it would prevent shape interaction while the panel is visible.

---

## Finding 2 — Toolbar State Clear on Tool Switch

**Decision**: When switching tools, clear `selectedIds`, `draggingId`, `dragStart`, `draftElement`, `resizeHandle`, `resizeSession` all in one synchronous batch.

**Rationale**: These are all transient interaction state fields. A partial clear would leave stale state that the new tool might misinterpret (e.g., a leftover `draftElement` from a shape tool would cause the renderer to show a ghost shape).

**Alternatives considered**: Clearing only selection and draft — rejected because drag/resize state could leak to the new tool.

---

## Finding 3 — Active Tool Highlighting

**Decision**: Toolbar renders all tools in a loop; the active tool gets `background: '#2563eb'` (blue) and `color: 'white'`; inactive tools get `background: 'transparent'` and `color: '#374151'`.

**Rationale**: Inline styles (no Tailwind classes on the toolbar) keep the toolbar self-contained and testable without CSS class name side effects in jsdom.

**Alternatives considered**: Tailwind `bg-blue-600` class — avoided in this component to keep the visual logic in JS where tests can verify the active state directly via the store.
