# CLAUDE.md

Project: Realtime Collaborative Tactical Whiteboard (web app).
**Source of truth for scope and phases: `docs/SPEC.md`. Read it before planning or coding.**

## Communication
- Talk to me in Vietnamese.
- Code, comments, identifiers, and commit messages in English.

## Tech stack
- Frontend: React + TypeScript + Vite. Rendering is **SVG/DOM-first**; a Canvas overlay is added only in Phase 3C (freehand/highlighter/eraser). Images render via SVG `<image>` / `<img>`, not Canvas.
- State: Zustand. Keep committed state (`elements`) separate from transient interaction state.
- Realtime: Socket.IO. Server: Node + TypeScript + Express + Socket.IO, room state in-memory (authoritative-light).
- Persistence: localStorage + BroadcastChannel in Phase 1; PostgreSQL + Prisma from Phase 3A.
- Conflict resolution: Last-Write-Wins via `version` + `versionNonce`.
- Monorepo: `client/` `server/` `shared/` (shared types).

## Architecture rules (non-negotiable)
1. Unified element store — everything is an `Element`; the renderer never holds state.
2. **Every element mutation goes through ONE mutation pipeline** (`createElement` / `patchElement` / `deleteElements` / `updateElements`). Never mutate the store directly elsewhere. The pipeline handles `version++`, `versionNonce`, `updatedAt`, history capture, local persist, and broadcast.
3. One shared **apply-remote** function applies external changes (BroadcastChannel in P1B, Socket.IO in P2) using LWW. Reuse it for both — do not write two.
4. Each shape type is a **ShapeUtil** (render / hitTest / resize / export). Adding a shape type must not touch the core.
5. Shared camera transform across all layers; all coordinates go through `screenToWorld` / `worldToScreen`.
6. Sync data, not renderer — only `Element` data crosses the network/tabs.
7. `zIndex` is an integer for now (no fractional indexing).

## Workflow
- Work **one phase at a time**, in the order in `docs/SPEC.md` (P0 → P1A → P1B → …). Do not build features from later phases ahead of time.
- **Plan before coding**: propose a task plan for the current phase and wait for my approval, then implement.
- Commit after each logical group of tasks.

## Commands
- (fill in after Phase 0 scaffolding: dev / build / test / lint)