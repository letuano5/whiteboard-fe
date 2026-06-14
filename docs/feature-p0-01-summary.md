# P0-01: Khung dự án & Shared Types — Tóm tắt triển khai

|                     |                      |
| ------------------- | -------------------- |
| **Task**            | P0-01                |
| **Ngày hoàn thành** | 2026-06-11           |
| **Phase**           | Phase 0 — Foundation |

---

## Những gì đã làm

Khởi tạo toàn bộ cấu trúc frontend project từ một repo git trống, bao gồm:

- **Vite 6** làm bundler với `@vitejs/plugin-react` và `@tailwindcss/vite`
- **TypeScript 5.9** với strict mode, `moduleResolution: "bundler"`, path alias `@/*`
- **React 19** entry point (StrictMode + createRoot)
- **Tailwind CSS 4** CSS-first (không có `tailwind.config.js`, dùng `@import "tailwindcss"`)
- **ESLint 9** flat config (`eslint.config.ts`) với typescript-eslint + react-hooks
- **Prettier 3** theo cấu hình trong CLAUDE.md
- **Vitest 3** với jsdom environment và `@testing-library/jest-dom`
- **Shared types** đầy đủ theo SPECS.md §2.1–2.4
- **WS_EVENTS** constants stub cho P2+ (10 events)
- **Folder structure** theo CLAUDE.md với `.gitkeep` cho các thư mục rỗng

---

## Files đã tạo/sửa

| File                           | Loại     | Mô tả                                                                    |
| ------------------------------ | -------- | ------------------------------------------------------------------------ |
| `.gitignore`                   | Thay thế | Thay file cũ (copy từ React repo) bằng .gitignore chuẩn cho Vite         |
| `package.json`                 | Tạo mới  | Dependencies + scripts đầy đủ; `pnpm.onlyBuiltDependencies: ["esbuild"]` |
| `tsconfig.json`                | Tạo mới  | References tsconfig.app.json + tsconfig.node.json                        |
| `tsconfig.app.json`            | Tạo mới  | Config cho src/: strict, bundler, path alias                             |
| `tsconfig.node.json`           | Tạo mới  | Config cho vite.config.ts                                                |
| `vite.config.ts`               | Tạo mới  | Vite + React + Tailwind plugin + path alias + Vitest test block          |
| `eslint.config.ts`             | Tạo mới  | ESLint 9 flat config với typescript-eslint + react-hooks                 |
| `.prettierrc`                  | Tạo mới  | Đúng theo CLAUDE.md spec                                                 |
| `index.html`                   | Tạo mới  | Root HTML                                                                |
| `src/vite-env.d.ts`            | Tạo mới  | Khai báo `vite/client` types (CSS import, env vars)                      |
| `src/main.tsx`                 | Tạo mới  | React 19 bootstrap với createRoot                                        |
| `src/app/App.tsx`              | Tạo mới  | Component stub                                                           |
| `src/index.css`                | Tạo mới  | `@import "tailwindcss"`                                                  |
| `src/types/shared.ts`          | Tạo mới  | Toàn bộ shared types + WS_EVENTS                                         |
| `src/types/shared.test.ts`     | Tạo mới  | 6 unit tests cho WS_EVENTS constants                                     |
| `src/test/setup.ts`            | Tạo mới  | `@testing-library/jest-dom/vitest` setup                                 |
| `src/canvas/*/...`             | Tạo mới  | `.gitkeep` placeholder                                                   |
| `src/store/`, `src/sync/`, ... | Tạo mới  | `.gitkeep` placeholder                                                   |

---

## Quyết định thiết kế & lý do

### 1. tsconfig chia 3 file (app / node / root)

Theo chuẩn Vite cho TypeScript project: `tsconfig.app.json` dành cho browser code (src/), `tsconfig.node.json` cho tooling (vite.config.ts, eslint.config.ts), `tsconfig.json` là root references để IDE nhận diện đúng cả hai.

### 2. Tailwind CSS 4 — không có `tailwind.config.js`

Tailwind 4 dùng CSS-first config: `@import "tailwindcss"` trong CSS file là đủ. Plugin `@tailwindcss/vite` tự scan source files. Không cần PostCSS, không cần `tailwind.config.js`, không cần `autoprefixer`.

### 3. ESLint config — không dùng `reactHooks.configs.flat.recommended` với `defineConfig`

`eslint-plugin-react-hooks` v5.2.0 không tương thích trực tiếp với `extends` array của `defineConfig`. Workaround: thêm plugin thủ công qua `plugins` + `rules: reactHooks.configs.recommended.rules`.

### 4. `@testing-library/jest-dom` — dùng `/vitest` path

`import '@testing-library/jest-dom'` mặc định kéo theo `@types/jest` gây lỗi TypeScript. Dùng `import '@testing-library/jest-dom/vitest'` để augment Vitest matchers mà không cần Jest types.

### 5. WS_EVENTS — stub đầy đủ 10 events

Theo lựa chọn của user: định nghĩa tất cả events đã biết từ spec (P2-P3A) ngay từ đầu. Giúp import sẵn và ít "magic strings" khi implement các phase sau.

### 6. `pnpm.onlyBuiltDependencies: ["esbuild"]`

pnpm 10 block tất cả build scripts theo mặc định. esbuild cần postinstall script để download binary cho đúng platform. Thêm vào `package.json` để cho phép một cách tường minh.

---

## Kết quả kiểm thử

| Lệnh             | Kết quả                    |
| ---------------- | -------------------------- |
| `pnpm typecheck` | ✓ 0 lỗi                    |
| `pnpm build`     | ✓ bundle 194KB (gzip 61KB) |
| `pnpm lint`      | ✓ 0 lỗi                    |
| `pnpm test`      | ✓ 6/6 tests pass           |

---

## Công việc còn lại

P0-01 hoàn thành. Các task tiếp theo trong Phase 0:

- **P0-02**: Zustand stores (`elements`, `interaction`, `camera`) + `screenToWorld` / `worldToScreen`
- **P0-03**: ShapeUtil registry + SVG layer render cơ bản
- **P0-04**: Mutation pipeline (`createElement`, `patchElement`, `deleteElements`, `updateElements`)
