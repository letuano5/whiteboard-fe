# CLAUDE.md — Frontend

> Common project context (communication rules, full stack, workflow, shared conventions)
> is in the root `CLAUDE.md`. This file covers frontend-specific details only.

## Stack notes

- Rendering is **SVG/DOM-first** for all shapes, including freehand/highlighter/eraser (Phase 3C). Canvas overlay is deferred (see `docs/SPECS.md` §11 note v0.5) — only reconsider if profiling shows a real bottleneck beyond current object-count scale. Images render via SVG `<image>` / `<img>`, never Canvas.
- State: Zustand — keep committed state (`elements`) separate from transient interaction state.
- Realtime: Socket.IO. Server state is in-memory (authoritative-light) until Phase 3A.
- Persistence: localStorage + BroadcastChannel (Phase 1); PostgreSQL + Prisma (Phase 3A+).
- Conflict resolution: Last-Write-Wins via `version` + `versionNonce`.

### Zustand 5 (v5.0.14)

- Named import only: `import { create } from 'zustand'` (default import removed in v5)
- Always use curried TypeScript pattern: `create<State & Actions>()((set, get) => ({...}))`
- Middleware: `import { devtools, subscribeWithSelector } from 'zustand/middleware'`; wrap `devtools` outermost
- Shallow equality for selectors: `import { useShallow } from 'zustand/react/shallow'`

## Architecture rules (non-negotiable)

1. Unified element store — everything is an `Element`; the renderer never holds state.
2. **Every element mutation goes through ONE mutation pipeline** (`createElement` / `patchElement` / `deleteElements` / `updateElements`). Never mutate the store directly elsewhere. The pipeline handles `version++`, `versionNonce`, `updatedAt`, history capture, local persist, and broadcast.
3. One shared **apply-remote** function applies external changes (BroadcastChannel in P1B, Socket.IO in P2) using LWW. Reuse it for both — do not write two.
4. Each shape type is a **ShapeUtil** (render / hitTest / resize / export). Adding a shape type must not touch the core.
5. Shared camera transform across all layers; all coordinates go through `screenToWorld` / `worldToScreen`.
6. Sync data, not renderer — only `Element` data crosses the network/tabs.
7. `zIndex` is an integer for now (no fractional indexing).

## Folder structure

```
frontend/
├── src/
│   ├── app/                   ← App.tsx, providers
│   ├── canvas/
│   │   ├── layers/            ← SvgLayer.tsx, DraftLayer.tsx (P3C, isolated re-render)
│   │   ├── shapes/            ← ShapeUtil per type + registry index
│   │   ├── tools/             ← Tool handlers (select, draw, pan…)
│   │   └── Whiteboard.tsx     ← root canvas component
│   ├── store/                 ← elements.store.ts, interaction.store.ts, camera.store.ts
│   ├── sync/                  ← apply-remote.ts, broadcast-channel.ts, socket.ts
│   ├── components/            ← toolbar/, detail-panel/, ui/
│   ├── hooks/                 ← useKeyboard.ts, …
│   ├── types/
│   │   ├── shared.ts          ← re-export from @vdt/shared
│   │   ├── geometry.ts        ← Point, Rect (pure geometry primitives)
│   │   └── interaction.ts     ← ToolId, HandleId, InteractionState (frontend-only)
│   ├── utils/                 ← camera.ts, geometry.ts, id.ts
│   └── main.tsx
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json              ← references tsconfig.app.json + tsconfig.node.json
├── tsconfig.app.json          ← extends ../tsconfig.base.json
├── tsconfig.node.json         ← extends ../tsconfig.base.json
├── eslint.config.ts
└── package.json
```

## Commands

```bash
# Dev server (Vite) — run from root or frontend/
pnpm dev

# Type-check
pnpm typecheck

# Build
pnpm build

# Lint / fix
pnpm lint
pnpm lint:fix

# Format
pnpm format
pnpm format:check

# Test
pnpm test
pnpm test:watch
pnpm test:coverage
```
