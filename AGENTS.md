# AGENTS.md

Project: Realtime Collaborative Tactical Whiteboard (web app).
**Source of truth for scope and phases: `docs/SPECS.md`. Read it before planning or coding.**

## Communication

- Talk to me in Vietnamese.
- Code, comments, identifiers, and commit messages in English.

## Project layout

Monorepo managed by pnpm workspaces:

```text
vdt-whiteboard/
├── frontend/          ← React + Vite (package: whiteboard-fe)
├── backend/           ← Node + Express + Socket.IO (package: whiteboard-be)
├── packages/
│   └── shared/        ← Shared types: Element, Camera, Presence, WS_EVENTS (@vdt/shared)
├── docs/              ← SPECS.md + feature summaries
├── specs/             ← Per-feature spec/plan/tasks
├── tsconfig.base.json ← Common TS compiler options (extended by each package)
└── .prettierrc        ← Shared formatting config
```

**Shared types** (`@vdt/shared`): single source of truth in `packages/shared/src/index.ts`.
Both frontend and backend import from `@vdt/shared` via workspace link.

## Tech stack

### Frontend (`frontend/`)

| Layer           | Package            | Version            |
| --------------- | ------------------ | ------------------ |
| Runtime         | Node.js            | 22.x LTS           |
| Package manager | pnpm               | 10.x               |
| Bundler         | Vite               | 8.x                |
| Language        | TypeScript         | 6.x                |
| UI framework    | React              | 19.x               |
| State           | Zustand            | 5.x                |
| Realtime client | socket.io-client   | 4.8.x              |
| Styling         | Tailwind CSS       | 4.x                |
| Linter          | ESLint             | 10.x (flat config) |
| Formatter       | Prettier           | 3.x                |
| TS lint         | @typescript-eslint | 8.x                |
| Testing         | Vitest             | 4.x                |

### Backend (`backend/`)

| Layer            | Package    | Version  |
| ---------------- | ---------- | -------- |
| Runtime          | Node.js    | 22.x LTS |
| Package manager  | pnpm       | 10.x     |
| Language         | TypeScript | 5.8.x    |
| Server framework | Express    | 5.x      |
| Realtime server  | socket.io  | 4.8.x    |
| ORM (P3A+)       | Prisma     | 6.x      |
| Database (P3A+)  | PostgreSQL | 17.x     |

## Shared conventions

### Formatting (Prettier — root `.prettierrc`)

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

- `strict: true` always (via `tsconfig.base.json`).
- `moduleResolution: "bundler"` in all tsconfigs.
- No `any` — use `unknown` + narrowing.
- Each package extends root `tsconfig.base.json`.

### Naming

| What                    | Convention                 | Example                           |
| ----------------------- | -------------------------- | --------------------------------- |
| TS/TSX files            | `kebab-case`               | `apply-remote.ts`                 |
| React components        | `PascalCase` file + export | `Whiteboard.tsx`                  |
| Types / Interfaces      | `PascalCase`               | `Element`, `Camera`               |
| Variables / functions   | `camelCase`                | `createElement`                   |
| Module-level constants  | `SCREAMING_SNAKE_CASE`     | `WS_EVENTS`, `MIN_ZOOM`           |
| WebSocket event strings | `kebab-case`               | `"element-update"`, `"join-room"` |

## Workflow

- Work **one phase at a time**, in the order in `docs/SPECS.md` (P0 → P1A → P1B → …).
- **Plan before coding**: propose a task plan and wait for approval, then implement.
- Commit after each logical group of tasks.

## Commands

```bash
# Dev — frontend only
pnpm dev

# Dev — frontend + backend in parallel
pnpm dev:all

# Build frontend
pnpm build

# Typecheck all packages
pnpm typecheck

# Lint (packages that define the script)
pnpm lint

# Format (root covers all files)
pnpm format
pnpm format:check

# Test all packages
pnpm test

# Per-package (from root)
pnpm --filter whiteboard-fe dev
pnpm --filter whiteboard-be dev
```

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
`specs/024-reconnect-diff/plan.md`.
<!-- SPECKIT END -->

## Established architectural decisions

### URL routing (P2+)

Room-based routing uses the **query-string pattern**: `/?room=<uuid>`.
- Implemented with native `URLSearchParams` + `window.history.pushState`.
- No router library (react-router-dom, etc.) is used or needed.
- The room ID is a UUID v4 string.
