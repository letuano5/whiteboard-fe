# CLAUDE.md

Project: Realtime Collaborative Tactical Whiteboard (web app).
**Source of truth for scope and phases: `docs/SPECS.md`. Read it before planning or coding.**

## Communication

- Talk to me in Vietnamese.
- Code, comments, identifiers, and commit messages in English.

## Project layout

Two **separate** repos, run independently:

```
vdt-whiteboard/
├── frontend/   ← this repo (React + Vite)
└── backend/    ← separate repo (Node + Express + Socket.IO)
```

**Shared types** (`Element`, `Camera`, `Presence`…): each repo maintains its own copy in `src/types/shared.ts`. When the data model changes, update **both** files manually. This is intentional — no monorepo, no workspace overhead.

## Tech stack

### Frontend (this repo)

| Layer           | Package            | Version           |
| --------------- | ------------------ | ----------------- |
| Runtime         | Node.js            | 22.x LTS          |
| Package manager | pnpm               | 10.x              |
| Bundler         | Vite               | 8.x               |
| Language        | TypeScript         | 6.x               |
| UI framework    | React              | 19.x              |
| State           | Zustand            | 5.x               |
| Realtime client | socket.io-client   | 4.8.x             |
| Styling         | Tailwind CSS       | 4.x               |
| Linter          | ESLint             | 10.x (flat config) |
| Formatter       | Prettier           | 3.x               |
| TS lint         | @typescript-eslint | 8.x               |
| Testing         | Vitest             | 4.x               |

### Backend (separate repo)

| Layer            | Package    | Version  |
| ---------------- | ---------- | -------- |
| Runtime          | Node.js    | 22.x LTS |
| Package manager  | pnpm       | 10.x     |
| Language         | TypeScript | 5.8.x    |
| Server framework | Express    | 5.x      |
| Realtime server  | socket.io  | 4.8.x    |
| ORM (P3A+)       | Prisma     | 6.x      |
| Database (P3A+)  | PostgreSQL | 17.x     |

### Stack notes

- Rendering is **SVG/DOM-first**; Canvas overlay added only in Phase 3C (freehand/highlighter/eraser). Images render via SVG `<image>` / `<img>`, never Canvas.
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

## Code conventions

### Folder structure

**Frontend** (`frontend/`):

```
frontend/
├── src/
│   ├── app/                   ← App.tsx, providers
│   ├── canvas/
│   │   ├── layers/            ← SvgLayer.tsx, CanvasLayer.tsx (P3C)
│   │   ├── shapes/            ← ShapeUtil per type + registry index
│   │   ├── tools/             ← Tool handlers (select, draw, pan…)
│   │   └── Whiteboard.tsx     ← root canvas component
│   ├── store/                 ← elements.store.ts, interaction.store.ts, camera.store.ts
│   ├── sync/                  ← apply-remote.ts, broadcast-channel.ts, socket.ts
│   ├── components/            ← toolbar/, detail-panel/, ui/
│   ├── hooks/                 ← useKeyboard.ts, …
│   ├── types/
│   │   ├── shared.ts          ← Element, Camera, Presence, WS_EVENTS (keep in sync w/ backend)
│   │   ├── geometry.ts        ← Point, Rect (pure geometry primitives)
│   │   └── interaction.ts     ← ToolId, HandleId, InteractionState (frontend-only)
│   ├── utils/                 ← camera.ts, geometry.ts, id.ts
│   └── main.tsx
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── eslint.config.ts
├── .prettierrc
└── package.json
```

### Naming

| What                    | Convention                 | Example                                |
| ----------------------- | -------------------------- | -------------------------------------- |
| TS/TSX files            | `kebab-case`               | `apply-remote.ts`, `SvgLayer.tsx`      |
| React components        | `PascalCase` file + export | `Whiteboard.tsx`                       |
| Hooks                   | `camelCase`, prefix `use`  | `useKeyboard.ts`                       |
| Types / Interfaces      | `PascalCase`               | `Element`, `Camera`, `ShapeUtil`       |
| Variables / functions   | `camelCase`                | `createElement`, `applyRemoteElements` |
| Module-level constants  | `SCREAMING_SNAKE_CASE`     | `WS_EVENTS`, `MIN_ZOOM`                |
| WebSocket event strings | `kebab-case`               | `"element-update"`, `"join-room"`      |

### Formatting (Prettier config)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

### TypeScript

- `strict: true` always.
- `moduleResolution: "bundler"` in client/server tsconfigs.
- Extend `tsconfig.base.json` from each package.
- No `any` — use `unknown` + narrowing.

## Workflow

- Work **one phase at a time**, in the order in `docs/SPECS.md` (P0 → P1A → P1B → …). Do not build features from later phases ahead of time.
- **Plan before coding**: propose a task plan for the current phase and wait for my approval, then implement.
- Commit after each logical group of tasks.

## Commands

Each repo runs independently. Commands below are for **this frontend repo**.

```bash
# Dev server (Vite)
pnpm dev

# Type-check
pnpm typecheck

# Build
pnpm build

# Preview production build
pnpm preview

# Lint
pnpm lint

# Lint + auto-fix
pnpm lint:fix

# Format check
pnpm format:check

# Format write
pnpm format

# Test (Vitest)
pnpm test

# Test watch mode
pnpm test:watch

# Test with coverage
pnpm test:coverage
```

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
`specs/010-undo-redo/plan.md`.
<!-- SPECKIT END -->
