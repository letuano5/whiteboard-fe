<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0 (initial ratification — all placeholders replaced)
Modified principles: n/a (first fill)
Added sections:
  - I. Unified Element Store
  - II. Element Versioning
  - III. Shared Camera Transform
  - IV. ShapeUtil Strategy
  - V. Sync Data, Not Renderer
  - VI. Single Mutation Pipeline
  - VII. Committed vs Transient State
  - Tech Stack Constraints
  - Development Workflow
  - Governance
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ — Constitution Check section references updated principles
  - .specify/templates/spec-template.md ✅ — no constitution-specific changes required
  - .specify/templates/tasks-template.md ✅ — no constitution-specific changes required
Follow-up TODOs:
  - RATIFICATION_DATE set to 2026-06-07 (date of SPECS.md v0.2); confirm if an earlier date is preferred.
-->

# Realtime Collaborative Tactical Whiteboard — Frontend Constitution

## Core Principles

### I. Unified Element Store

Every drawable object on the canvas is an `Element` stored in a single committed-state store
(`elements.store.ts`). The renderer is a pure view: it MUST NOT hold authoritative state, cache
derived geometry, or make decisions about which elements exist.

**Rationale**: A single source of truth prevents divergence between layers (SVG, Canvas overlay,
detail panel) and is the prerequisite for deterministic sync and undo.

### II. Element Versioning

Every element mutation MUST increment `version` by 1 and re-randomize `versionNonce`.
`updatedAt` MUST be set to `Date.now()` at the same time.
No code outside the mutation pipeline may touch these three fields.

**Rationale**: `version + versionNonce` is the foundation for Last-Write-Wins conflict resolution
and for the "only send what changed" optimization (Phase 3A).

### III. Shared Camera Transform

All rendering layers (SVG layer, future Canvas overlay) MUST share a single camera
`{ x, y, zoom }` from `camera.store.ts`.
Coordinate conversion between screen and world MUST go through `screenToWorld` / `worldToScreen`.
No layer may compute its own independent transform.

**Rationale**: Independent transforms cause visual misalignment between layers and make
cursor-to-world mapping unreliable.

### IV. ShapeUtil Strategy Pattern

Each element `type` MUST be encapsulated in a `ShapeUtil` module that declares:
`render`, `hitTest`, `resize`, and `export`. The core canvas and mutation pipeline
MUST NOT contain type-specific branching (`if type === 'rectangle' …`).
Adding a new shape type MUST require only adding a new `ShapeUtil` — zero changes to core.

**Rationale**: Keeps the core stable as the shape library grows; prevents accidental coupling
between unrelated shape types.

### V. Sync Data, Not Renderer

Only `Element[]` data crosses network boundaries (Socket.IO) and tab boundaries
(BroadcastChannel). Render state, interaction state, camera, and cursor positions
MUST NOT be serialized into the sync payload (presence/cursor are ephemeral, handled separately).

**Rationale**: Decouples rendering technology from sync protocol; makes the sync layer
testable without a DOM.

### VI. Single Mutation Pipeline

Every element change — from any source (tool, keyboard shortcut, detail panel, undo, paste) —
MUST go through the four pipeline functions: `createElement`, `patchElement`,
`deleteElements`, `updateElements`. Direct store writes outside the pipeline are FORBIDDEN.
The pipeline is the single place that handles versioning, history capture, local persist,
and broadcast.

**Rationale**: Undo/redo, sync, and persistence are "free" for every feature because they
are wired once at the pipeline, not per-caller.

### VII. Committed vs Transient State

State is split into two Zustand stores that MUST NOT be merged:

- **Committed** (`elements.store.ts`): persisted, synced, undo-able. Contains `Element[]`.
- **Transient** (`interaction.store.ts`): ephemeral, never saved or broadcast. Contains
  `tool`, `selectedIds`, `draftElement`, `marquee`, `laserTrail`, `remoteCursors`, etc.

Saving/syncing reads ONLY from the committed store.

**Rationale**: Prevents ephemeral UI state from polluting the persistence layer and causing
spurious diffs during sync.

## Tech Stack Constraints

- **Rendering**: SVG/DOM-first through Phase 2.5. A Canvas overlay is added only in Phase 3C
  and only for point-heavy ink types (freehand, highlighter, eraser).
  Images MUST render via SVG `<image>` or DOM `<img>` — never via Canvas.
- **State management**: Zustand 5.x. Named imports only (`import { create } from 'zustand'`).
  Always use the curried TypeScript pattern. `devtools` middleware wraps outermost.
- **Realtime**: Socket.IO 4.8.x client. The `applyRemoteElements` function (single
  implementation) handles both BroadcastChannel (Phase 1B) and Socket.IO (Phase 2) — no
  parallel implementations.
- **Conflict resolution**: Last-Write-Wins via `version + versionNonce` (higher `version` wins;
  tie broken by lower `versionNonce` for determinism).
- **Persistence**: localStorage + BroadcastChannel through Phase 1; PostgreSQL + Prisma from
  Phase 3A onward. No IndexedDB, no E2E encryption (out of scope per SPECS.md §13).
- **zIndex**: Integer only (no fractional indexing) until further notice.
- **Language**: TypeScript `strict: true` everywhere. No `any` — use `unknown` + narrowing.

## Development Workflow

- Work **one phase at a time** in the order defined in `docs/SPECS.md` (P0 → P1A → P1B → …).
  Features from later phases MUST NOT be built ahead of time.
- **Plan before coding**: propose a task plan for the current phase and obtain explicit approval
  before writing implementation code.
- **Commit discipline**: commit after each logical group of tasks; commits MUST be in English
  and describe intent, not mechanics.
- **Language split**: all code, comments, identifiers, and commit messages MUST be in English.
  Communication with the user is in Vietnamese.
- **Shared types discipline**: `src/types/shared.ts` exists in both frontend and backend repos.
  When the data model changes, both files MUST be updated manually and in the same commit group.

## Governance

This constitution supersedes all other practices, conventions, or tribal knowledge.
Any conflict between this document and another guideline resolves in favor of this document.

**Amendment procedure**:
1. Propose the change in writing with rationale and impact on existing code.
2. Obtain explicit user approval before updating this file.
3. Increment `CONSTITUTION_VERSION` following semantic versioning:
   - MAJOR — backward-incompatible removal or redefinition of a principle.
   - MINOR — new principle or section added / materially expanded.
   - PATCH — clarification, wording, or typo fix.
4. Update `LAST_AMENDED_DATE` to today's date (ISO 8601).
5. Run the consistency propagation checklist (see Sync Impact Report header) and update
   any affected templates.

**Compliance review**: Every plan (`/speckit-plan`) MUST include a Constitution Check gate
that verifies no principle is violated before implementation begins.

**Version**: 1.0.0 | **Ratified**: 2026-06-07 | **Last Amended**: 2026-06-23
