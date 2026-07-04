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

### File organization

- Split files by concern, not mechanically by function count. Common concerns:
  bootstrap/wiring, socket/event handlers, domain state logic, pure selectors/helpers,
  React presentation components, and local types/contracts.
- Keep bootstrap and wiring files thin. `index.ts`, `main.tsx`, and server entry files should
  compose dependencies and start the app; target `< 80` lines.
- Prefer source files under `200` lines. Files in the `200-300` line range need an explicit
  reason to stay together. Files over `300` lines must be split unless they are generated files
  or intentionally broad integration tests.
- When a feature has three or more closely related files, create a feature folder instead of
  spreading them across generic folders.
- React component files use `PascalCase.tsx`. Non-component TypeScript files use `kebab-case.ts`
  or clear domain names such as `types.ts`, `selectors.ts`, or `constants.ts`.
- Keep local types near the module that uses them. Move types to `@vdt/shared` only when both
  frontend and backend need them as part of the data contract.
- Folder `index.ts` files are public API barrels for code outside that folder. Files inside the
  same folder must import each other directly (for example `./room-state`), not through their own
  folder barrel.
- Reusable logic must have a single implementation. Before writing a new helper, selector, parser,
  geometry function, socket utility, or persistence helper, search the codebase for an existing
  equivalent and reuse or extend it.
- Do not copy-paste shared behavior into multiple modules. If the same behavior is needed in two
  places, extract it to the nearest sensible owner: feature-local first, package-level second,
  `@vdt/shared` only for frontend/backend contracts.
- Keep reusable functions pure when practical and cover extracted shared behavior with focused
  tests near its owning module.
- Avoid broad files named `helpers.ts`, `utils.ts`, or `misc.ts` unless every export is tightly
  tied to one domain. Prefer names that state the responsibility, such as `join-room.ts`,
  `room-state.ts`, `SelectionOverlay.tsx`, or `SnapIndicators.tsx`.

#### Backend handlers

- Socket handler modules receive their dependencies explicitly, including `ioServer`, `socket`,
  state maps/repositories, and autosave services. Handlers should not import mutable singleton
  room state directly.
- Handler modules own expected domain error handling for their event. They should log with a
  stable prefix and emit a typed socket error response when the client can act on the failure.
- Wiring modules may wrap handlers for unexpected failures, but business fallback behavior belongs
  in the handler that understands the event.
- Handler tests follow the handler name: `join-room.ts` pairs with `__tests__/join-room.test.ts`.

#### Tooling enforcement

- ESLint should enforce file-size guardrails with `max-lines`, with stricter overrides for entry
  files where practical.
- Filename conventions should be enforced by tooling such as `unicorn/filename-case` or a local
  custom rule.
- Import cycles should be rejected by tooling such as `import/no-cycle`.
- Do not rely on review alone for conventions that can be checked automatically.

## Workflow

- Work **one phase at a time**, in the order in `docs/SPECS.md` (P0 → P1A → P1B → …).
- **Plan before coding**: propose a task plan and wait for approval, then implement.
- Commit after each logical group of tasks.
- For structural refactors, choose the next target by practical pain (conflicts, bug density,
  review friction, or mixed concerns), not by backend/frontend order alone.
- Refactors that split files must preserve behavior and should be committed by logical group.

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
