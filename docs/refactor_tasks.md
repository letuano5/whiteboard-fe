# Refactor Tasks

## Recommendation

Do not refactor all targets in one large session. The codebase has several files that touch the
same interaction surface, especially `select-tool.ts`, `Whiteboard.tsx`, and `SvgLayer.tsx`.
Refactor them in small, behavior-preserving groups.

You do not need eight separate chats unless you want very isolated review. A practical split is
five to six sessions:

1. Backend realtime entry and socket handlers.
2. SVG layer rendering and overlay components.
3. Select tool geometry/interaction logic.
4. Whiteboard orchestration hooks.
5. Detail panel component split.
6. Socket client / repository / lint enforcement cleanup.

Some groups can run in parallel if they avoid the same files. The "Parallel lane" field below
marks groups that can be worked at the same time with low conflict risk.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

## Parallel Lanes

| Lane | Scope | Can run with | Avoid running with |
| ---- | ----- | ------------ | ------------------ |
| A | Backend realtime + repository | B, C, D, E | F if adding shared lint scripts |
| B | SVG layer split | A, D, E | C, because selection overlay contracts may move |
| C | Select tool split | A, D, E | B and D, because pointer/selection contracts overlap |
| D | Whiteboard orchestration hooks | A, B, E | C, because pointer handler contracts overlap |
| E | Detail panel UI split | A, B, C, D | None expected |
| F | Tooling/test utilities | A, B, C, D, E | Any active branch changing package scripts/config heavily |

## Group A: Backend Realtime Structure

Parallel lane: A

Goal: make backend entry files thin and move socket behavior into explicit handler modules.

- [ ] A1. Split `backend/src/index.ts` into bootstrap and composition files.
  - Target files:
    - `backend/src/index.ts`
    - `backend/src/app.ts`
    - `backend/src/realtime/whiteboard-server.ts`
  - Expected result: `index.ts` only loads env, creates the app/server, wires default deps, and listens.

- [ ] A2. Create explicit realtime state/dependency modules.
  - Target files:
    - `backend/src/realtime/room-state.ts`
    - `backend/src/realtime/types.ts`
  - Expected result: room presence, elements, clocks, autosave deps, and payload types have a clear owner.

- [ ] A3. Split socket handlers by event.
  - Target files:
    - `backend/src/realtime/handlers/join-room.ts`
    - `backend/src/realtime/handlers/element-update.ts`
    - `backend/src/realtime/handlers/element-draft.ts`
    - `backend/src/realtime/handlers/cursor-move.ts`
    - `backend/src/realtime/handlers/disconnect.ts`
  - Expected result: handlers receive `ioServer`, `socket`, and deps explicitly.

- [ ] A4. Move backend socket tests to handler-oriented imports.
  - Target tests:
    - `backend/src/persistence/socket-join.test.ts`
    - `backend/src/persistence/socket-delta-clock.test.ts`
    - `backend/src/persistence/socket-autosave.test.ts`
    - `backend/src/persistence/socket-reconnect.test.ts`
  - Expected result: tests no longer import socket composition through the old persistence path.

- [ ] A5. Validate backend behavior.
  - Commands:
    - `pnpm --filter whiteboard-be typecheck`
    - `pnpm --filter whiteboard-be test:run`

## Group B: SVG Layer Rendering Split

Parallel lane: B

Goal: make `SvgLayer.tsx` a small composition component and move overlays/render helpers into
focused modules.

- [ ] B1. Create `frontend/src/canvas/layers/svg/` feature folder.
  - Target files:
    - `SvgLayer.tsx`
    - `ElementLayer.tsx`
    - `DraftLayer.tsx`
    - `RemoteDraftLayer.tsx`
    - `SelectionOverlay.tsx`
    - `RemoteSelectionOverlay.tsx`
    - `MarqueeOverlay.tsx`
    - `LaserTrailOverlay.tsx`
    - `SnapIndicators.tsx`
    - `selectors.ts`
    - `types.ts`

- [ ] B2. Extract pure selector logic from current `SvgLayer.tsx`.
  - Candidates:
    - visible elements excluding local/remote drafts
    - selected overlay element
    - multi-select bounds
    - snap indicator points

- [ ] B3. Extract presentation-only overlay components.
  - Expected result: components render props and do not read Zustand unless there is a strong local reason.

- [ ] B4. Preserve public import path or update callers.
  - Current caller:
    - `frontend/src/canvas/Whiteboard.tsx`

- [ ] B5. Validate SVG layer behavior.
  - Commands:
    - `pnpm --filter whiteboard-fe test -- SvgLayer`
    - `pnpm --filter whiteboard-fe typecheck`

## Group C: Select Tool Split

Parallel lane: C

Goal: break `select-tool.ts` into domain modules without changing interaction behavior.

- [x] C1. Move rectangle helpers into a reusable geometry owner.
  - Candidates currently local to `select-tool.ts`:
    - `normalizeRect`
    - `rectsIntersect`
  - Target owner:
    - `frontend/src/utils/geometry.ts` or `frontend/src/canvas/tools/select/geometry.ts`
  - Rule: use package-level `utils/geometry.ts` only if needed outside select tool.

- [x] C2. Extract resize logic.
  - Target file:
    - `frontend/src/canvas/tools/select/resize.ts`
  - Candidates:
    - handle direction helpers
    - `getResizeAnchor`
    - `getFlippedHandle`
    - `resizeBoundsFromAnchorAndPointer`
    - text resize scale/font size helpers

- [x] C3. Extract point-geometry movement helpers.
  - Target file:
    - `frontend/src/canvas/tools/select/point-geometry.ts`
  - Candidates:
    - `translatePointGeometry`
    - `resizePointGeometry`

- [x] C4. Extract bound-arrow draft logic.
  - Target file:
    - `frontend/src/canvas/tools/select/bound-arrows.ts`
  - Candidates:
    - `isFullyBoundArrow`
    - `computeBoundArrowDrafts`
    - multi-drag bound arrow update logic

- [x] C5. Extract clipboard actions.
  - Target file:
    - `frontend/src/canvas/tools/select/clipboard.ts`
  - Candidates:
    - `cloneAsNewDraft`
    - `onDuplicateSelected`
    - `onCopySelected`
    - `onPasteSelected`

- [x] C6. Keep event entry points stable.
  - Existing exports should remain available from `frontend/src/canvas/tools/select-tool.ts`
    or through a compatibility barrel until callers/tests are updated.

- [x] C7. Validate select behavior.
  - Commands:
    - `pnpm --filter whiteboard-fe test -- select-tool`
    - `pnpm --filter whiteboard-fe test -- endpoint-handle`
    - `pnpm --filter whiteboard-fe test -- rotate-tool`
    - `pnpm --filter whiteboard-fe typecheck`

## Group D: Whiteboard Orchestration Hooks

Parallel lane: D

Goal: keep `Whiteboard.tsx` as composition and move pan/zoom/keyboard/pointer orchestration into
hooks or focused helpers.

- [x] D1. Extract pointer coordinate helpers.
  - Candidates:
    - `svgLocalPoint`
    - repeated `getBoundingClientRect` + `screenToWorld` conversions
  - Target owner:
    - `frontend/src/canvas/pointer-coordinates.ts`

- [x] D2. Extract wheel pan/zoom hook.
  - Target file:
    - `frontend/src/canvas/hooks/use-wheel-pan-zoom.ts`

- [x] D3. Extract space-to-pan mode hook.
  - Target file:
    - `frontend/src/canvas/hooks/use-space-pan-mode.ts`

- [x] D4. Extract keyboard shortcut hook.
  - Target file:
    - `frontend/src/canvas/hooks/use-whiteboard-shortcuts.ts`

- [x] D5. Extract pointer handler hook after Group C stabilizes.
  - Target file:
    - `frontend/src/canvas/hooks/use-whiteboard-pointer-handlers.ts`
  - Dependency:
    - Prefer after C6 so select tool entry points are stable.

- [x] D6. Validate whiteboard behavior.
  - Commands:
    - `pnpm --filter whiteboard-fe test -- zoom-pan`
    - `pnpm --filter whiteboard-fe typecheck`

## Group E: Detail Panel Component Split

Parallel lane: E

Goal: reduce `DetailPanel.tsx` by extracting repeated controls and selection patch logic.

- [ ] E1. Create `frontend/src/components/detail-panel/` subcomponents.
  - Target files:
    - `PanelShell.tsx`
    - `SectionTitle.tsx`
    - `ColorControl.tsx`
    - `NumberControl.tsx`
    - `SelectControl.tsx`
    - `RangeControl.tsx`
    - `TransformControls.tsx`
    - `StyleControls.tsx`
    - `TextControls.tsx`

- [ ] E2. Extract selection patch helpers.
  - Target file:
    - `frontend/src/components/detail-panel/selection-patches.ts`
  - Expected result: single-select and multi-select patching are clear and tested.

- [ ] E3. Keep `DetailPanel.tsx` as composition only.
  - Expected result: component selects state, derives selected elements, and composes sections.

- [ ] E4. Validate detail panel behavior.
  - Commands:
    - `pnpm --filter whiteboard-fe test -- DetailPanel`
    - `pnpm --filter whiteboard-fe typecheck`

## Group F: Sync Client, Repository, Tooling, Test Utilities

Parallel lane: F

Goal: clean remaining high-friction files and enforce the new convention with tooling.

- [ ] F1. Split frontend socket client.
  - Target folder:
    - `frontend/src/sync/socket/`
  - Target files:
    - `client.ts`
    - `state.ts`
    - `event-handlers.ts`
    - `subscriptions.ts`
    - `pending-queue.ts`
    - `types.ts`
  - Keep compatibility exports from `frontend/src/sync/socket-client.ts` until callers are updated.

- [ ] F2. Split backend room repository by concern.
  - Target folder:
    - `backend/src/persistence/room-repository/`
  - Target files:
    - `load-room.ts`
    - `save-room.ts`
    - `room-diff.ts`
    - `types.ts`
    - `index.ts`
  - Avoid changing repository behavior while moving code.

- [ ] F3. Extract backend socket test utilities.
  - Target file:
    - `backend/src/test/fake-socket-io.ts`
  - Candidates duplicated across tests:
    - `makeFakeIo`
    - `makeSocket`
    - `connect`
    - `getHandler`

- [ ] F4. Add lint enforcement for file-size and import cycles.
  - Targets:
    - `frontend/eslint.config.ts`
    - backend lint config/script if introduced
    - `package.json`
    - `frontend/package.json`
    - `backend/package.json`
  - Notes:
    - Adding `eslint-plugin-import` or `eslint-plugin-unicorn` may require dependency install.
    - If avoiding new deps, start with built-in `max-lines` and document filename/no-cycle follow-up.

- [ ] F5. Validate all packages after tooling changes.
  - Commands:
    - `pnpm typecheck`
    - `pnpm lint`
    - `pnpm test`

## Suggested Session Plan

### Session 1: Backend Realtime

- [ ] A1
- [ ] A2
- [ ] A3
- [ ] A4
- [ ] A5

### Session 2: SVG Layer

- [ ] B1
- [ ] B2
- [ ] B3
- [ ] B4
- [ ] B5

### Session 3: Select Tool

- [ ] C1
- [ ] C2
- [ ] C3
- [ ] C4
- [ ] C5
- [ ] C6
- [ ] C7

### Session 4: Whiteboard Hooks

- [ ] D1
- [ ] D2
- [ ] D3
- [ ] D4
- [ ] D5
- [ ] D6

### Session 5: Detail Panel

- [ ] E1
- [ ] E2
- [ ] E3
- [ ] E4

### Session 6: Remaining Cleanup

- [ ] F1
- [ ] F2
- [ ] F3
- [ ] F4
- [ ] F5

## Global Completion Criteria

- [ ] No production source file over 300 lines unless explicitly justified.
- [ ] Entry/bootstrap files target under 80 lines where practical.
- [ ] No duplicated reusable helper where an existing owner is available.
- [ ] Folder barrels are used only from outside the folder.
- [ ] Typecheck passes for all packages.
- [ ] Relevant tests pass for each refactor group.
- [ ] Full `pnpm lint` and `pnpm test` pass after tooling cleanup.
