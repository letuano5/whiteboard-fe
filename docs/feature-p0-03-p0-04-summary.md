# P0-03 & P0-04 — ShapeUtil Registry, SVG Layer, Mutation Pipeline

## Đã làm gì

### P0-03: ShapeUtil Registry & SVG Layer

Xây dựng hệ thống render shapes dạng SVG/DOM-first:

- **`src/utils/id.ts`** — hàm `generateId()` dùng `crypto.randomUUID()` để sinh ID element.
- **`src/canvas/shapes/types.ts`** — interface `ShapeUtil<T>` với 4 phương thức: `render`, `hitTest`, `getBounds`, `resize`. `hitTest`/`resize` là stubs cho P0 (sẽ implement thật ở P1A/P1B).
- **`src/canvas/shapes/`** — 5 shape utils:
  - `rectangle.tsx` → `<rect>`
  - `ellipse.tsx` → `<ellipse>` (cx/cy tính từ x+w/2, y+h/2)
  - `diamond.tsx` → `<polygon>` 4 điểm (top/right/bottom/left)
  - `line.tsx` → `<polyline>` nếu có `props.points`, ngược lại `<line>` từ (x,y) đến (x+w,y+h)
  - `text.tsx` → `<text>` với fontSize, fontFamily, textAnchor
  - `utils.ts` — helper `strokeDashArray()` convert strokeStyle → SVG dasharray
- **`src/canvas/shapes/index.ts`** — registry `Map<ElementType, ShapeUtil>` với `registerShapeUtil` / `getShapeUtil`.
- **`src/canvas/layers/SvgLayer.tsx`** — render tất cả elements lên SVG layer:
  - Camera transform: `<g transform="scale(zoom) translate(-camera.x -camera.y)">` — elements được đặt ở world coords, group transform chuyển sang screen.
  - Filter `isDeleted`, sort theo `zIndex`, lookup ShapeUtil từ registry.
- **`src/canvas/Whiteboard.tsx`** — container đọc stores và render `SvgLayer`.
- **`src/app/App.tsx`** — sửa để render `<Whiteboard>` thay `<h1>`.

### P0-04: Mutation Pipeline

Module `src/store/mutation-pipeline.ts` — pipeline mutation duy nhất cho toàn bộ ứng dụng:

| Hàm | Mô tả |
|-----|-------|
| `createElement(draft)` | Sinh ID, tự gán `version=1`, `versionNonce`, `updatedAt`, `zIndex=max+1`, `isDeleted=false` |
| `patchElement(id, patch)` | Cập nhật một số field; `version++`, nonce mới, updatedAt mới; bỏ qua nếu id không tồn tại hoặc đã bị xóa mềm |
| `deleteElements(ids)` | Soft delete (`isDeleted=true`); element vẫn trong store; `version++` |
| `updateElements(patches)` | Batch patch nhiều elements cùng lúc |

**Hook system**: `registerMutationHook(hook)` trả về hàm `unregister`. Mọi mutation kích hoạt `MutationEvent { type, elements }`. Dùng để cắm history (P1B), localStorage persist (P1A), Socket.IO broadcast (P2).

## Files thay đổi

| File | Hành động |
|------|-----------|
| `src/utils/id.ts` | Tạo mới |
| `src/canvas/shapes/types.ts` | Tạo mới |
| `src/canvas/shapes/utils.ts` | Tạo mới |
| `src/canvas/shapes/rectangle.tsx` | Tạo mới |
| `src/canvas/shapes/ellipse.tsx` | Tạo mới |
| `src/canvas/shapes/diamond.tsx` | Tạo mới |
| `src/canvas/shapes/line.tsx` | Tạo mới |
| `src/canvas/shapes/text.tsx` | Tạo mới |
| `src/canvas/shapes/index.ts` | Tạo mới |
| `src/canvas/layers/SvgLayer.tsx` | Tạo mới |
| `src/canvas/Whiteboard.tsx` | Tạo mới |
| `src/app/App.tsx` | Sửa |
| `src/store/mutation-pipeline.ts` | Tạo mới |
| `src/utils/id.test.ts` | Tạo mới |
| `src/canvas/shapes/__tests__/registry.test.ts` | Tạo mới |
| `src/canvas/shapes/__tests__/shapes.test.tsx` | Tạo mới |
| `src/store/__tests__/mutation-pipeline.test.ts` | Tạo mới |

## Quyết định thiết kế

1. **Camera transform trong SVG**: Dùng `scale(zoom) translate(-x -y)` trên một `<g>` bao ngoài — elements render ở world coordinates, group chịu trách nhiệm chuyển sang screen. Cách này clean hơn so với tính `worldToScreen` cho từng element.

2. **Mutation pipeline là module riêng** (không phải store action): Import `useElementsStore.getState()` imperatively — tránh circular dependency, dễ test, rõ ràng về "đây là layer business logic, không phải data layer".

3. **`versionNonce` là integer ngẫu nhiên** (`Math.floor(Math.random() * 1e9)`) — tương thích với pattern LWW của Excalidraw, phù hợp cho conflict resolution ở P3A.

4. **Soft delete**: `deleteElements` set `isDeleted=true`, không xóa khỏi store — cần thiết để P3A (Prisma sync) có thể restore và broadcast delete event.

5. **5 shapes cơ bản cho P0**: rectangle, ellipse, diamond, line, text. Các shapes phức tạp (arrow, freehand, image, polygon) thuộc các phase sau.

6. **ShapeUtil interface đầy đủ ngay từ P0**: `hitTest`/`getBounds`/`resize` được định nghĩa trong interface (với stub implementation) để P1A/P1B có thể fill in mà không phải thay đổi interface.

## Kiểm tra

- `pnpm typecheck` — pass (no errors)
- `pnpm test` — **72 tests pass** (6 test files: id, registry, shapes, mutation-pipeline + test cũ từ P0-01/02)

## Việc còn lại (phase tiếp theo)

- **P1A**: Select tool, drawing tool, hitTest/resize thật sự, localStorage persist, history undo/redo.
- `registerMutationHook` sẽ được gọi từ P1A để cắm persist và history.
