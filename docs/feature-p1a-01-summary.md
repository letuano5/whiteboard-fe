# P1A-01 — Tạo shape: Rectangle, Ellipse, Line, Text

## Những gì đã làm

Triển khai tính năng tạo shape bằng cách kéo chuột trên canvas. Người dùng chọn tool (Rectangle / Ellipse / Line / Text) từ thanh công cụ, sau đó kéo chuột để tạo shape mới.

## Files thay đổi

| File | Thay đổi |
|------|----------|
| `src/canvas/tools/create-shape-tool.ts` | **Mới** — logic kéo-để-tạo shape |
| `src/components/toolbar/Toolbar.tsx` | **Mới** — thanh công cụ floating bottom-center |
| `src/canvas/layers/SvgLayer.tsx` | Thêm prop `draftElement` + pointer event callbacks |
| `src/canvas/Whiteboard.tsx` | Layout fullscreen, pointer event handlers, fix tọa độ |

## Quyết định thiết kế

**Draft element (`'__draft__'` ID):**
Trong khi kéo, một `draftElement` được tạo trong `InteractionState` (transient). Element này có ID `'__draft__'` và không đi qua mutation pipeline, chỉ dùng để render preview với opacity 0.6. Khi nhả chuột (nếu đủ kích thước ≥ 5px), mới gọi `createElement()` để commit vào store.

**Fix tọa độ offset:**
Sử dụng `e.currentTarget.getBoundingClientRect()` để chuyển `e.clientX/Y` (viewport coords) sang tọa độ cục bộ của SVG trước khi áp dụng `screenToWorld()`. Đây là bắt buộc để tọa độ không bị lệch khi canvas không bắt đầu từ góc (0,0) của viewport.

**Pointer capture:**
`e.currentTarget.setPointerCapture(e.pointerId)` được gọi khi `onPointerDown` để đảm bảo drag tracking hoạt động ngay cả khi con trỏ ra ngoài SVG.

**Line shape:**
Khác với rectangle/ellipse, line lưu thêm `props.points = [[startX, startY], [endX, endY]]` với tọa độ tuyệt đối trong world, để ShapeUtil render đúng hướng line bất kể chiều kéo.

**Icons:**
Dùng `lucide-react` (tree-shakable) thay vì tự vẽ SVG. Chỉ import 6 icon cần thiết: `MousePointer2, Hand, Square, Circle, Minus, Type`.

**Toolbar:**
Floating absolute ở `bottom: 16px, left: 50%, transform: translateX(-50%)` bên trong container Whiteboard. Width tự động fit theo số nút, không ảnh hưởng layout canvas (không chiếm không gian như sidebar).

## Cách test

1. `pnpm typecheck` — pass
2. `pnpm test --run` — 90/90 tests pass (thêm 13 tests mới cho `create-shape-tool`)
3. Manual: chọn Rectangle → kéo trên canvas → shape xuất hiện đúng vị trí con trỏ

## Việc còn lại (P1A tiếp theo)

- **P1A-02**: Select — click chọn shape, hiện bounding box + handles
- **P1A-03**: Move / Resize / Delete
- **P1A-04**: Style panel cơ bản
- **P1A-05**: Text editing (double-click)
- **P1A-06**: Zoom + Pan (infinite canvas)
- **P1A-07**: Detail panel
- **P1A-08**: Toolbar đầy đủ (keyboard shortcuts V/H/R/O/L/T)
- **P1A-09**: localStorage persistence
- **P1A-10**: z-order render
