# Tóm tắt Feature: P1A-03 Move / Resize / Delete Shape

**Ngày hoàn thành**: 2026-06-23
**Branch**: `feat/local-editor`
**Spec**: `specs/002-move-resize-delete/`

---

## Tổng quan

Feature P1A-03 mở rộng select-tool (đã có từ P1A-02) để người dùng có thể:
- **Di chuyển** shape bằng cách kéo thân (body drag)
- **Resize** shape từ bất kỳ một trong 8 handle
- **Xóa** shape bằng phím Del/Backspace

---

## Files đã thay đổi

| File | Loại thay đổi | Mô tả |
|------|--------------|-------|
| `src/canvas/tools/select-tool.ts` | MODIFY | Thêm `onSelectPointerMove`, `onSelectPointerUp`, `onSelectHandlePointerDown`, `computeResize`, `onSelectKeyDown` |
| `src/canvas/layers/SvgLayer.tsx` | MODIFY | Handle `<circle>` có `onPointerDown` + `stopPropagation` + SVG pointer capture; prop `onHandlePointerDown` truyền từ Whiteboard |
| `src/canvas/Whiteboard.tsx` | MODIFY | Route `pointerMove`/`pointerUp` cho select tool; `handleHandlePointerDown`; `useEffect` keyboard handler |
| `src/canvas/tools/__tests__/select-tool.test.ts` | MODIFY | Thêm 12 test bao phủ AC-1..AC-12 |
| `src/canvas/layers/__tests__/SvgLayer.test.tsx` | MODIFY | Thêm test AC-10 (soft-deleted không render) |
| `specs/002-move-resize-delete/` | NEW | Spec, plan, tasks, acceptance, research, data-model, quickstart |

---

## Quyết định thiết kế và lý do

### 1. Commit-only mutation (không patch mỗi frame)
`patchElement` chỉ được gọi **một lần** khi `pointerUp` — không gọi mỗi `pointerMove`. Live preview qua `draftElement` trong interaction store (cùng pattern với `create-shape-tool.ts`).

**Lý do**: Tránh flood mutation pipeline và history stack với hàng trăm patch nhỏ trong một lần kéo. Mỗi undo step phải là một thao tác logic, không phải sub-pixel delta.

### 2. computeResize — hàm pure, type-agnostic
Resize geometry (anchor-opposite cho 8 handle, clamp min 1px) được tách ra thành hàm pure `computeResize(el, handle, worldPt)` trong `select-tool.ts`. Không có type branching, testable không cần DOM.

### 3. Pointer capture trên SVG root
`svgEl.setPointerCapture(e.pointerId)` được gọi trên SVG root (không phải trên circle handle). Khi đó các event `pointermove`/`pointerup` tiếp theo đều đi vào SVG root handlers của Whiteboard, dù pointer đã ra ngoài SVG.

### 4. Handle drag path tách biệt với body drag path
`onSelectHandlePointerDown` là một hàm export riêng (không merge vào `onSelectPointerDown`). Handle circles dùng `stopPropagation` để SVG root không nhận pointerdown khi click handle.

### 5. Delete qua window keyboard event
`useEffect` trong Whiteboard đăng ký `window.keydown` listener, chỉ kích hoạt khi `tool === 'select'`. Cleanup listener trả về từ effect để tránh memory leak.

---

## Kết quả test

```
✅ 12/12 AC tests pass (AC-1..AC-12 từ specs/002-move-resize-delete/acceptance.md)
✅ Tất cả tests cũ của P1A-02 vẫn xanh
✅ pnpm typecheck: 0 lỗi
✅ pnpm lint: 0 lỗi/cảnh báo
```

---

## Acceptance Criteria đã đạt

| AC | Mô tả | Test |
|----|-------|------|
| AC-1 | Move live preview: draftElement.x/y = el.x + dx | select-tool.test.ts |
| AC-2 | Move commit: store.x/y cập nhật, version++ | select-tool.test.ts |
| AC-3 | Click canvas trống: không bắt đầu drag | select-tool.test.ts |
| AC-4 | Resize se: width/height tăng, x/y không đổi | select-tool.test.ts |
| AC-5 | Resize nw: x/y dịch, width/height giảm | select-tool.test.ts |
| AC-6 | Resize n: y dịch, height giảm, x/width không đổi | select-tool.test.ts |
| AC-7 | Clamp: width/height không xuống dưới 1 world unit | select-tool.test.ts |
| AC-8 | Resize commit: store cập nhật dims, version++ | select-tool.test.ts |
| AC-9 | Delete: isDeleted = true | select-tool.test.ts |
| AC-10 | Soft-deleted element không render | SvgLayer.test.tsx |
| AC-11 | Delete: selectedIds = [] | select-tool.test.ts |
| AC-12 | Delete khi không chọn gì: no-op | select-tool.test.ts |

---

## Công việc còn lại (ngoài scope P1A-03)

- **P1A-04**: Style panel (strokeColor, fillColor, strokeWidth, opacity)
- **P1A-05**: Text editing (font, size, align)
- **P1A-06**: Zoom + Pan + Infinite canvas
- **P1B-01**: Rotate + Resize khi đã xoay (angle ≠ 0)
- Pointer capture cho handle drag không được test bởi unit tests (cần browser test manual)
