# Tóm tắt tính năng: P1A-02 Select Shape (angle = 0)

**Ngày hoàn thành**: 2026-06-23  
**Branch**: `feat/local-editor`  
**Spec**: [`specs/001-select-shape/`](../specs/001-select-shape/)

---

## Những gì đã làm

Implement click-to-select cho shapes trên whiteboard canvas. Khi select tool đang active:

- Click vào shape → shape được chọn, hiện bounding box + 8 resize handle (visual only)
- Click vào vùng trống → bỏ chọn
- Khi hai shape chồng nhau, shape có `zIndex` cao hơn được ưu tiên
- Trạng thái chọn chỉ tồn tại trong `interactionStore.selectedIds` (transient), không được ghi vào elements store hay localStorage

---

## Files đã thay đổi

### Tạo mới

| File | Mục đích |
|------|---------|
| `src/canvas/tools/select-tool.ts` | Logic click-to-select: `onSelectPointerDown(worldPt)` |
| `src/canvas/tools/__tests__/select-tool.test.ts` | Unit tests cho select-tool (AC-1 đến AC-6) |
| `src/canvas/layers/__tests__/SvgLayer.test.tsx` | Test SelectionOverlay (AC-7) |

### Sửa đổi

| File | Thay đổi |
|------|---------|
| `src/canvas/shapes/rectangle.tsx` | Implement AABB `hitTest` |
| `src/canvas/shapes/ellipse.tsx` | Implement AABB `hitTest` |
| `src/canvas/shapes/text.tsx` | Implement AABB `hitTest` |
| `src/canvas/shapes/diamond.tsx` | Implement AABB `hitTest` |
| `src/canvas/shapes/line.tsx` | Implement point-to-segment `hitTest` (threshold 8 world units) |
| `src/canvas/shapes/__tests__/shapes.test.tsx` | Thay stub tests bằng real hitTest unit tests |
| `src/canvas/layers/SvgLayer.tsx` | Thêm `SelectionOverlay` component; đọc `selectedIds` từ store |
| `src/canvas/Whiteboard.tsx` | Wire `onSelectPointerDown` vào `handlePointerDown` khi `tool === 'select'` |

---

## Quyết định thiết kế & lý do

### 1. Hit-test strategy (angle=0)

- **Rectangle, ellipse, text, diamond**: AABB containment (`px ∈ [x, x+w]` và `py ∈ [y, y+h]`). Đơn giản, chính xác ở angle=0.
- **Line**: Point-to-segment distance ≤ 8 world units. AABB của line gần như vô dụng khi line nằm ngang hoặc dọc; segment distance cho trải nghiệm tốt hơn.

### 2. Z-order priority

Sort mảng `visible` theo `zIndex` descending trước khi iterate → shape đầu tiên hit là shape có zIndex cao nhất. Đảm bảo AC-2 luôn đúng.

### 3. SelectionOverlay trong SVG camera group

Overlay được render bên trong `<g transform="scale(zoom) translate(-x, -y)">` → tự động follow camera pan/zoom mà không cần tính toán tọa độ thêm.

### 4. Handle là visual-only

8 `<circle>` render ở vị trí nw/ne/sw/se/n/s/e/w, không có pointer event. Interactive resize sẽ implement ở P1A-03.

### 5. Không capture pointer

`onShapePointerDown` capture pointer để track drag, nhưng `onSelectPointerDown` chỉ cần pointerdown đơn thuần (single-click). Không cần pointer capture.

---

## Cách đã test

- **TDD**: Viết tests trước, verify FAIL, rồi implement.
- **Unit tests** (Vitest + jsdom):
  - `shapes.test.tsx`: hitTest cho tất cả 5 shape types (inside → true, outside → false, boundary, zero-size, line distance)
  - `select-tool.test.ts`: AC-1 đến AC-6 (select, z-order, replace selection, deselect, no-error, state isolation)
  - `SvgLayer.test.tsx`: AC-7 (8 circles khi selected, 0 circles khi không)
- **Kiểm tra**: `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm test` ✅ (115/115 pass)

---

## Acceptance Criteria (từ `specs/001-select-shape/acceptance.md`)

| ID | Mô tả | Test |
|----|-------|------|
| AC-1 | Click trong bbox → selectedIds có ID shape | `@covers AC-1` ✅ |
| AC-2 | Overlap → zIndex cao hơn thắng | `@covers AC-2` ✅ |
| AC-3 | Click B trong khi A chọn → chỉ B trong selectedIds | `@covers AC-3` ✅ |
| AC-4 | Click vùng trống → selectedIds = [] | `@covers AC-4` ✅ |
| AC-5 | Click vùng trống khi không có selection → không lỗi | `@covers AC-5` ✅ |
| AC-6 | selectedIds KHÔNG ghi vào elementsStore hay localStorage | `@covers AC-6` ✅ |
| AC-7 | Selected shape → 8 handle circles | `@covers AC-7` ✅ |

---

## Việc còn lại / TODOs

- **P1A-03**: Move / Resize cơ bản — handles hiện tại là visual-only, chưa interactive
- **P2+**: Multi-select (marquee, shift-click), angle-aware hit-test (rotation)
- AC coverage guard (`scripts/check-ac-coverage.sh`) chưa cài — nên setup ở feature tiếp theo
