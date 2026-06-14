# P0-02: Store & Camera Utils — Tóm tắt triển khai

## Những gì đã làm

Cài đặt nền tảng state management cho toàn bộ whiteboard app:
3 Zustand stores riêng biệt + camera transform utilities + unit tests.

## Các file thay đổi

| File                             | Hành động                                                |
| -------------------------------- | -------------------------------------------------------- |
| `src/utils/camera.ts`            | Tạo mới — constants + 2 pure functions                   |
| `src/store/elements.store.ts`    | Tạo mới — Zustand store cho committed `Element[]`        |
| `src/store/interaction.store.ts` | Tạo mới — Zustand store cho transient `InteractionState` |
| `src/store/camera.store.ts`      | Tạo mới — Zustand store cho `Camera`                     |
| `src/store/index.ts`             | Tạo mới — re-export tất cả hooks                         |
| `src/utils/camera.test.ts`       | Tạo mới — unit tests (28 tests)                          |
| `CLAUDE.md`                      | Cập nhật — thêm Zustand 5 canonical setup notes          |

## Quyết định thiết kế & lý do

### 3 stores riêng biệt (không merge)

CLAUDE.md đã định nghĩa rõ `elements.store.ts`, `interaction.store.ts`, `camera.store.ts` là 3 file tách biệt.
Lý do: mỗi store có tính chất khác nhau (committed/persisted, transient, camera transform) và nhiều component
chỉ cần subscribe vào một phần — tách store giúp tránh re-render thừa.

### `elements.store` — chỉ primitive setters

Store chỉ có `setElements`, `addElement`, `updateElement`, `updateElements`, `removeElements`.
Mutation pipeline cao hơn (`createElement`, `patchElement`, `deleteElements` với versioning + history + broadcast)
sẽ được xây trong **P0-04** và gọi các primitives này. Đây là nguyên tắc kiến trúc "một pipeline duy nhất".

### `interaction.store` — có `reset()`

`reset()` trả về toàn bộ transient state về default. Cần thiết khi đổi tool, escape gesture, v.v.
`remoteCursors` là `Map<string, Presence>` — khởi tạo `new Map()` mới mỗi lần reset (không share reference).

### `camera.store.zoomTo` — hỗ trợ pivot point

`zoomTo(zoom, pivot?)` tính lại pan offset để điểm pivot giữ nguyên vị trí trên màn hình khi zoom.
Công thức: `newX = pivot.x / newZoom - pivot.x / oldZoom + oldX`. Pivot là screen coords.
Clamp zoom vào `[MIN_ZOOM, MAX_ZOOM]` (từ `camera.ts`).

### `screenToWorld` / `worldToScreen` — pure functions, không clamp

Hai hàm chỉ tính toán, không validate hay clamp — đơn giản, dễ test, dễ inline.
Clamp zoom là trách nhiệm của store mutation.

Transform:

- `screenToWorld`: `x = screenX / zoom + camera.x`
- `worldToScreen`: `x = (worldX - camera.x) * zoom`

### Zustand 5 — curried pattern bắt buộc

`create<State>()((set, get) => ({...}))` — double call cần thiết để TypeScript infer đúng generic
khi có middleware. Đã ghi vào CLAUDE.md để các phase sau không cần research lại.

## Cách test

28 unit tests trong `src/utils/camera.test.ts`:

- `screenToWorld`: zoom=1/2/0.5, với/không có pan, tọa độ âm, MIN_ZOOM, MAX_ZOOM
- `worldToScreen`: cùng bộ cases
- Round-trip: `screenToWorld → worldToScreen` và ngược lại phải là identity với sai số `1e-10`
- 5 camera configurations khác nhau (origin, pan dương, pan âm, zoom biên)

Chạy: `pnpm test --run` — tất cả 28 tests xanh.

## Công việc còn lại / TODO

- **P0-03**: Skeleton `Whiteboard.tsx` + `SvgLayer.tsx` + `App.tsx` để render canvas trắng
- **P0-04**: Mutation pipeline (`createElement`, `patchElement`, `deleteElements`, `updateElements`)
  với versioning, history, localStorage persist, BroadcastChannel broadcast
- **P1A**: Tool select, resize, pan/zoom, render shapes qua `ShapeUtil`
- Chưa có `subscribeWithSelector` middleware — sẽ thêm khi cần subscribe state từ ngoài React (P1B sync)
- Chưa có `devtools` middleware — có thể thêm sau khi debug cần thiết
