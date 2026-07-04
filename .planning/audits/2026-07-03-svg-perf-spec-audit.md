# SVG Pipeline / Storage / Perf / Camera Audit — 2026-07-03

Scope: SVG rendering pipeline (canvas/shapes, canvas/layers/svg), sync/persistence layer
(backend/src/sync, backend/src/rooms), camera/viewport (frontend/src/store/camera.store.ts,
frontend/src/utils/camera.ts, frontend/src/sync/camera-persistence.ts), and spec coverage vs
`docs/SPECS.md`. Read-only audit (Codex), no fixes applied, no tests run. Consolidated from two
audit passes (short summary + detailed pass); duplicate findings from both passes are merged
below into a single entry with full detail preserved from both.

No Critical-severity finding. Suggested fix order from the audit: **H2 + H3 first** (real
operational risk — process crash / silent data loss), then **H1 + M6 + M7** as one batch
("hit-test correctness" via a shared helper), then **H4** (single server-side condition), then
**M1** (biggest render perf lever).

---

## Phần 1 — Lỗi tổng hợp (nặng → nhẹ)

### HIGH

**H1 — Eraser và context-menu hit-test không un-rotate điểm theo `element.angle`.**
- `frontend/src/canvas/tools/eraser-tool.ts:38`, `frontend/src/canvas/hooks/use-whiteboard-pointer-handlers.ts:232/235`.
- Mọi `ShapeUtil.hitTest` chạy trong hệ tọa độ chưa xoay (axis-aligned). Select-tool làm đúng:
  un-rotate điểm quanh tâm trước khi gọi (`pointer-down.ts:28`). Eraser và context-menu (right-click)
  gọi thẳng `util.hitTest(element, sample.x, sample.y)` với tọa độ world, không un-rotate.
- Tái hiện: vẽ rectangle dài, rotate 45°, rê eraser qua phần thân shape đang hiển thị → không xóa;
  rê qua vùng trống nơi bbox chưa xoay từng nằm → shape bị xóa. Vì eraser sync `isDeleted` qua
  mutation pipeline, xóa nhầm lan sang mọi peer.
- Fix: trích logic "un-rotate rồi hitTest" của select tool thành helper dùng chung
  (`hitTestElementAtWorldPoint(el, pt)`), gọi từ cả 3 nơi (eraser, context menu, select).

**H2 — Import/export native file (HTTP) có thể crash process backend khi gặp lỗi không xác định.**
- `backend/src/rooms/native-file-export.ts:167`, tương tự ở `native-file-import.ts:249`.
- `sendKnownExportError`/`sendKnownImportError` re-throw lỗi không nhận diện được (vd Prisma/DB down)
  ngay bên trong khối catch của handler. Handler được gọi kiểu `void handleNativeFileExport(...)`
  (`native-file-export.ts:48`) nên throw này thành unhandled promise rejection — Node 22 mặc định
  kill process, HTTP request treo không có response.
- Tái hiện: DB mất kết nối tạm thời, user bấm Export → backend crash, mọi phòng đang hoạt động mất
  kết nối.
- Fix: nhánh unknown-error trả 500 + log thay vì re-throw; hoặc bọc `void` call bằng `.catch()` trả 500.

**H3 — Phòng không có row trong DB: mọi `SyncCommand` fail vĩnh viễn và im lặng.**
- `backend/src/sync/sync-room-persistence.ts:203-209`, `backend/src/sync/sync-command.ts:116-118`,
  `backend/src/rooms/room-access-records.ts:110-116`.
- Chuỗi sự kiện: mở `/?room=<uuid-bất-kỳ>` (room chưa có trong DB) → `loadRoomWithAccess` trả về
  ephemeral room `visibility: 'link_edit'` → user được admit làm editor → client gửi `SYNC_COMMAND`
  → `commitPrismaChangeSet` chạy `room.updateMany({where: {id, documentClock: expected}})` → 0 row
  (room không tồn tại) → `CONDITIONAL_CLOCK_CONFLICT` → room bị mark unhealthy, reload (vẫn rỗng) →
  throw `ROOM_UNHEALTHY`. Nhưng `shouldEmitRejectAck` loại trừ `ROOM_UNHEALTHY` → không gửi reject
  ack. Client giữ command in-flight mãi (max 2 slot → queue đầy dần), edit chỉ còn optimistic local,
  không tới peer nào, không lưu đâu cả.
- Fix: hoặc upsert Room row khi tạo SyncRoom cho phòng chưa tồn tại, hoặc từ chối join phòng không
  tồn tại (trả `ROOM_NOT_FOUND`), và luôn emit reject ack (kể cả `ROOM_UNHEALTHY`) để client giải
  phóng in-flight slot.

**H4 — Sau lần GC `ProcessedRequest` đầu tiên, pending request "unknown" bị đánh dấu `expired`
sai → client vứt bỏ edit đang chờ khi reconnect.**
- `backend/src/persistence/room-repository/room-diff.ts:185`, phía client
  `frontend/src/sync/socket/p5-reconciliation.ts:283-290`.
- `getPendingRequestStatuses` trả `expired` cho mọi requestId không tìm thấy hễ
  `processedRequestHistoryStartsAtClock > 0` — tức chỉ cần room từng chạy GC một lần (rows > 24h)
  thì một command vừa gửi 2 giây trước, bị mất trên đường truyền lúc rớt mạng, khi reconnect sẽ nhận
  `expired` thay vì `unknown`. Client xử lý `expired` bằng cách drop pending + mark stale → mất edit
  thật của user, trái spec P5-07 (unknown → resend nếu còn relevant; expired chỉ dành cho pending
  quá retention).
- Fix: chỉ trả `expired` khi có bằng chứng request cũ hơn retention (so `clientClock`/thời điểm gửi
  với cutoff GC), mặc định trả `unknown`.

**H (không đánh số riêng) — Thiếu `ShapeUtil` cho nhiều element type đã có trong schema.**
- `frontend/src/canvas/shapes/index.ts:21`, `frontend/src/canvas/layers/svg/ElementLayer.tsx:62`.
- `image`, `triangle`, `polygon`, `frame`, `sticky`, `embed` có trong shared/native-file schema
  nhưng không có `ShapeUtil`; imported/synced elements loại này render `null` im lặng.
- Chi tiết thêm: `ToolId` có khai báo cho triangle/polygon nhưng registry (`shapes/index.ts`) không
  đăng ký. Diamond có `ShapeUtil` nhưng không có nút toolbar (`Toolbar.tsx:23-35`) — không cách nào
  vẽ được dù render được.
- Fix: hoặc implement ShapeUtil/render/hit-test tối thiểu cho các type đã nhận, hoặc reject/skip rõ
  trong import/sync cho tới khi được hỗ trợ.

**H (không đánh số riêng) — `setCamera` không clamp/validate.**
- `frontend/src/store/camera.store.ts:22`, `frontend/src/sync/camera-persistence.ts:16-23/30`,
  `packages/shared/src/native-file.ts:155`, `frontend/src/sync/socket/event-handlers.ts:139-142`.
- Clamp zoom chỉ nằm trong `zoomTo` và `fitToContent`; `setCamera` (được gọi với dữ liệu từ
  localStorage, từ echo `CURSOR_MOVE` qua socket, từ file import `NativeFileControls.tsx:98`) không
  kiểm tra. `loadCamera` chỉ check `typeof === 'number'` — `zoom: 0` hay số âm lọt qua → chia cho 0
  trong `screenToWorld` → NaN toàn canvas, app "trắng" cho tới khi xóa localStorage.
- Fix: clamp `[0.1, 8]` + `Number.isFinite` ngay trong `setCamera` (lớp bảo vệ trung tâm); native/
  local camera validation cũng nên enforce khoảng này.

### MEDIUM

**M1 — Không có viewport culling: toàn bộ element được mount vào SVG dù ngoài khung nhìn.**
- `frontend/src/canvas/layers/svg/ElementLayer.tsx:36-42`.
- `visibleElements` chỉ filter `isDeleted` + `hiddenDraftIds`, không cắt theo bbox giao viewport
  (`isAnyElementVisible` trong `utils/camera.ts:51` chỉ dùng cho nút Back-to-content). Room vài
  nghìn element → vài nghìn SVG node sống thường trực; mỗi lần pan/zoom browser phải re-composite
  tất cả.
- Fix: filter theo `getBounds(el)` giao world-rect của viewport (nới lề cho shape xoay/stroke/
  handles), memo theo `(elements, camera)`.

**M2 — Write amplification: mỗi patch nhỏ ghi lại toàn bộ state JSON của element.**
- `backend/src/sync/sync-room-persistence.ts:212-233`.
- `materializedElements` gộp cả patched → mỗi lần đổi màu 1 stroke freehand 600 điểm, transaction
  upsert lại nguyên `Record.state` (~vài chục KB). Drag với durable flush 100ms ≈ 10 full-row
  write/giây/element. Đây là hệ quả trực tiếp của thiết kế `state: Json` mà P5-13A đã chấp nhận —
  trade-off có chủ đích, không hẳn bug — nhưng đáng cân nhắc: (a) patch chỉ chạm style slot có thể
  dùng JSONB partial update; (b) hạ tần suất durable flush cho element point-heavy. Đường legacy
  autosave (`autosave.ts:77` + `save-room.ts:61`) còn nặng hơn — flush toàn bộ element của phòng mỗi
  lần dirty — nhưng chỉ còn phục vụ phòng không persist nên tác động thấp.

**M3 — State in-memory của phòng trên backend không bao giờ được giải phóng.**
- `backend/src/realtime/handlers/disconnect.ts:15-27`, `backend/src/sync/room-actor.ts:15`.
- Khi phòng về 0 client, chỉ `roomPresence` bị xóa. `syncRooms` (chứa toàn bộ elements + slotClocks
  + processedRequests cache), `roomElements`, `roomClocks`, và `RoomActorRegistry.actors` sống mãi.
  Server chạy lâu, mỗi phòng từng mở đều chiếm RAM vĩnh viễn.
- Fix: evict các map này khi phòng rỗng (an toàn vì P5 mọi commit đã durable từng command).

**M4 — Ngưỡng hit-test và snap tính theo world unit, không chia cho zoom.**
- `frontend/src/canvas/shapes/ink.tsx:6`, `line.tsx:49`, `arrow.tsx:77`, `arrow-binding.ts:5`.
- `HIT_THRESHOLD = 8` world unit: ở zoom 0.1 tương đương 0.8px màn hình — gần như không thể click
  trúng line/freehand khi zoom out; ở zoom 8 là 64px — click cách nét cả đốt ngón tay vẫn trúng.
  `ARROW_SNAP_THRESHOLD = 20` tương tự (comment còn ghi "view-independent" như thể là chủ đích,
  nhưng UX thực tế sai ở 2 cực zoom). Ink hit-test cũng bỏ qua strokeWidth (highlighter nét dày khó
  chọn đúng mép).
- Fix: truyền zoom vào hit-test hoặc dùng `threshold = base / camera.zoom`.

**M5 — Ellipse/diamond hit-test bằng bbox chữ nhật thay vì phương trình hình thật.**
- `frontend/src/canvas/shapes/ellipse.tsx:28-30`, `diamond.tsx:28-30`.
- Click/erase vào 4 góc bbox (ngoài hình elip/thoi thật) vẫn trúng. Kết hợp với H1 (eraser không
  un-rotate) → xóa nhầm shape không hề chạm. Với z-order, shape "trong suốt ở góc" che mất shape
  thật nằm dưới.
- Fix: ellipse dùng `(dx/rx)² + (dy/ry)² ≤ 1`, diamond dùng `|dx|/(w/2) + |dy|/(h/2) ≤ 1` (+ nới
  theo strokeWidth).

**M6 — zIndex trùng nhau giữa các peer khi tạo element đồng thời → z-order khác nhau giữa client.**
- `frontend/src/canvas/shapes/mutation-pipeline.ts:69/91`.
- `zIndex = maxZIndex + 1` tính từ store cục bộ; 2 peer tạo cùng lúc → cùng zIndex. `ElementLayer`
  sort không có tie-break (`ElementLayer.tsx:40`) nên thứ tự vẽ rơi về thứ tự mảng — vốn khác nhau
  giữa các client (thứ tự nhận broadcast). Hai client nhìn thấy hình chồng nhau theo chiều ngược
  nhau.
- Fix: tie-break bằng id khi sort; dài hạn theo spec P5-02 là `ReorderElementsCommand` + server
  normalize order.

**M7 — Hai tab cùng browser trong cùng phòng: cursor move ở tab này ép camera tab kia.**
- `frontend/src/sync/socket/event-handlers.ts:136-144`, `frontend/src/sync/socket/client.ts:31-40`.
- `sessionId` lưu trong localStorage (`presence.ts:39`) nên 2 tab chia sẻ cùng `sessionId`. Mỗi
  `pointermove` (throttle 33ms) emit `CURSOR_MOVE` kèm viewport hiện tại; server broadcast cho các
  socket khác trong phòng; tab kia thấy `sessionId === LOCAL_PRESENCE.sessionId` →
  `setCamera(data.viewport)` + `saveCamera`. Hệ quả: chỉ cần rê chuột ở tab A (không pan), camera
  tab B bị cưỡng chế theo A ở 30Hz; cả hai tab cùng thao tác thì camera giật qua lại.
- Nếu đây là tính năng "follow own session" thì cần cơ chế opt-in/deliberate pan signal, không phải
  mọi cursor move.

**M8 — Import native file vào local board bỏ qua mutation pipeline.**
- `frontend/src/sync/local/NativeFileControls.tsx:107-111`.
- `replaceLocalDocument` gọi thẳng `setElements` → không fire mutation hook → (a) không có history
  entry, Ctrl+Z sau import "nhảy" về quá khứ sai; (b) BroadcastChannel không phát — tab khác của
  cùng local board vẫn giữ scene cũ, và lần mutation kế tiếp từ tab cũ sẽ ghi đè lên scene vừa
  import (localStorage debounce 300ms hai tab đua nhau).
- Fix: đi qua một mutation/applySnapshot path có fire hook, hoặc phát broadcast + reset history
  thủ công.

**M9 — Chi phí hot-path mỗi `SyncCommand`: 1 query quyền vào DB + 2-3 lần copy toàn bộ element map.**
- `backend/src/sync/sync-command.ts:30/98-101`, `backend/src/sync/sync-room.ts:165`.
- Mỗi command (drag flush = 10 cmd/s/user) chạy `resolveRoomAccess` (DB round-trip với include
  members+invitations), `getStateSnapshot()` (copy nguyên map elements + slotClocks cho planner) và
  `mirrorSyncRoomState` (copy nguyên map lần nữa). Phòng 2000 element, 5 editor kéo đồng thời ≈ 150
  lần full-map copy + 50 query quyền mỗi giây.
- Fix: cache room access theo socket với TTL/invalidate khi role đổi; cho planner đọc trực tiếp
  state read-only thay vì snapshot copy.

**M10 — `getContentBounds`/`fitToContent`/Back-to-content dùng bbox chưa xoay.**
- `frontend/src/utils/camera.ts:34-70`.
- "Back to content" có thể crop góc shape xoay 45 độ, hoặc nút hiện/ẩn sai khi một mẩu shape xoay
  vẫn còn nhìn thấy nhưng nằm ngoài bbox axis-aligned.
- Fix: compute AABB sau rotation cho elements có `angle !== 0`, hoặc dùng ShapeUtil bounds đã
  transform-aware.
- (Các case khác của camera math đều ổn: scene rỗng ẩn nút ✓, isDeleted bị loại ✓, fitToContent
  clamp zoom ✓ — xem phần "Đã xác nhận OK" bên dưới.)

**M11 — Elbow routing (P2.5-06) chưa có, arrow chỉ vẽ đường thẳng.**
- `backend/src/sync/sync-room-planner.ts:433`, `frontend/src/canvas/shapes/arrow.tsx:47`.
- Binding repair tạo đúng 2 endpoint và `geometry.route: null`; renderer chỉ vẽ line thẳng, không có
  router orthogonal hay khái niệm tránh vật cản ở đâu cả.
- Fix: thêm router orthogonal và render polyline/path từ full `props.points`.

**M12 — Native file export saved document hardcode camera `{x:0, y:0, zoom:1}`.**
- `backend/src/rooms/native-file-export.ts:84`.
- Export/import saved document không round-trip camera hiện tại như P4-04 yêu cầu.
- Fix: persist camera per room/user, hoặc cho export nhận camera client-side đã validate.

### LOW

**L1 — Marquee selection dùng bbox chưa xoay.**
- `frontend/src/canvas/tools/select/pointer-up.ts:30-37`.
- Dùng `el.x/y/w/h` trực tiếp; shape xoay 45° thò ra ngoài bbox sẽ không được chọn dù khung marquee
  chạm phần nhìn thấy.

**L2 — Line/arrow hit-test và render chỉ dùng `points[0]`, `points[1]`.**
- `frontend/src/canvas/shapes/line.tsx:50-58`, `arrow.tsx:79-86`.
- Hiện an toàn vì tool chỉ tạo 2 điểm, nhưng sẽ gãy im lặng ngay khi P2.5-05 mở rộng multi-point
  (ink đã làm đúng bằng `some()` trên mọi segment).

**L3 — Eraser tạo nhiều undo entry và point-sampling có thể lọt shape mỏng.**
- `frontend/src/canvas/tools/eraser-tool.ts:48-55`.
- Mỗi segment trúng shape mới gọi `deleteElements` riêng → một lần quẹt eraser qua 8 shape tạo 8
  undo entry; nên gom về 1 entry lúc pointerup. Ngoài ra sweep là point-sampling mỗi 4 world-unit chứ
  không phải segment-intersection thật — đạt tinh thần P3C-04 (dùng lại hit-test có sẵn) nhưng có
  thể lọt shape mỏng <4 unit.

**L4 — Space-pan mode không có handler window blur.**
- `frontend/src/canvas/hooks/use-space-pan-mode.ts:15-17`.
- Giữ Space rồi Cmd+Tab sang app khác, quay lại thì `spaceDown` kẹt `true` (canvas kẹt chế độ pan)
  tới lần nhấn/nhả Space kế tiếp.

**L5 — Highlighter (P3C-03) có ShapeUtil render nhưng không có tool/toolbar để vẽ.**
- `frontend/src/types/interaction.ts:16`, `frontend/src/components/toolbar/Toolbar.tsx:23`.
- `highlighterShapeUtil` render được dữ liệu có sẵn, nhưng không có toolbar/pointer handler tạo
  highlighter mới; cũng chưa có opacity/strokeWidth mặc định riêng.
- Fix: thêm tool highlighter hoặc mode variant của freehand với props opacity/strokeWidth riêng.

**L6 — localStorage/camera-persistence: quota/storage errors bị nuốt im lặng.**
- `frontend/src/sync/local-storage.ts:35-41/74`, `frontend/src/sync/camera-persistence.ts:30`.
- Scene lớn vượt ~5MB (nhiều freehand) thì mọi lần save sau đều mất mà user không hề biết, reload
  là mất sạch thay đổi; đồng thời không flush khi `beforeunload`/`pagehide` nên đóng tab trong cửa
  sổ debounce 300ms mất thao tác cuối.
- Đã xác nhận không phải bug: không có race giữa 2 cơ chế debounce — local board dùng
  `VDT_WHITEBOARD_SCENE` (elements+camera chung 1 key), saved room chỉ dùng `VDT_CAMERA_{roomId}`;
  hai cơ chế không bao giờ chạy đồng thời (`bootstrap.ts:21-30`). `STORAGE_KEY` không scope theo
  board là by-design khi mỗi browser chỉ có đúng 1 local board; sẽ thành bug nếu làm P4
  multi-document local.
- Fix: báo UI một lần khi `setItem` fail + flush on `pagehide`.

**L7 — Tombstone không có GC.**
- Được spec cho phép (`tombstoneHistoryStartsAtClock = 0`, giữ vô hạn) — ghi nhận là nợ dung lượng
  chứ không phải bug.

**L8 — `buildFreehandPath` chạy lại Douglas-Peucker trên points đã simplified sẵn mỗi lần render.**
- `frontend/src/canvas/shapes/freehand-points.ts:112`.
- Draft re-render mỗi pointermove = simplify toàn stroke 60-120 lần/giây. Nên simplify một lần lúc
  commit, render chỉ build path string.

**L9 — Subscribe thừa gây re-render không cần thiết.**
- `frontend/src/components/BackToContent.tsx:36-37`: subscribe cả elements lẫn camera → mỗi frame
  pan/zoom chạy `getContentBounds` + `isAnyElementVisible` O(n).
- `frontend/src/canvas/layers/svg/SvgLayer.tsx:29-30`: subscribe `remoteCursors` chỉ để chuyền props
  xuống — mỗi cursor event của peer re-render shell + các overlay con (ElementLayer thoát nhờ memo).

---

## Phần 2 — Khoảng trống theo spec (chưa/thiếu implement)

| Mục spec | Trạng thái | Chi tiết |
|---|---|---|
| **P1B-02** triangle/polygon | Chưa đụng tới | Không có `ShapeUtil`, không có tool. `ToolId` có khai báo nhưng registry (`shapes/index.ts`) không đăng ký → element type này (vd từ file import) render `null` im lặng. Diamond có `ShapeUtil` nhưng không có nút toolbar (`Toolbar.tsx:23-35`) — không cách nào vẽ. |
| **P2.5-01** image | Chưa đụng tới | Không có `ShapeUtil`/tool; import file chứa image → biến mất im lặng. |
| **P2.5-05** point-based model | Đủ cơ bản | line/arrow/freehand đều tạo và mutate qua `props.points` (`create-shape-tool.ts:46-65`); `applyLinearNorm` giữ bbox sync (`mutation-pipeline.ts:47-59`). Còn fallback x/y/w/h cho element cũ. |
| **P2.5-06** elbow routing | Chưa bắt đầu | `arrow.tsx` chỉ vẽ đường thẳng + đầu mũi tên; không có khái niệm route/tránh vật cản ở đâu cả (= M11 ở Phần 1). |
| **P3C-03** highlighter | Một nửa | `highlighterShapeUtil` render được, nhưng không có tool, không có nút toolbar → không thể vẽ highlighter. Opacity/độ dày mặc định riêng cũng chưa có (= L5 ở Phần 1). |
| **P3C-04** eraser sweep | Một phần | Có sweep giữa 2 pointermove (sampling) + xóa nguyên shape + sync ✓; nhưng dính bug rotation (H1) và điểm yếu (L3). |
| **P3D** Redis | Chưa bắt đầu | Grep toàn bộ backend/frontend: 0 file liên quan Redis. Ngoài phạm vi audit này theo yêu cầu ban đầu. |
| **P4-00/01/02/03** | Có code đầy đủ | LoginToSave + local-board-save, DocumentDashboard (keyset pagination trong `document-pagination.ts`), ManageAccessModal + room-sharing + invitation, CapacitySettings + participant/editor limit + capacity downgrade (`join-room.ts:213-226`). Chưa audit sâu từng AC. |
| **P4-04** native file | Gần đủ | Schema version validate ✓, confirm trước khi replace ✓ (`NativeFileControls.tsx:151`), role check server-side ✓, import qua `ReplaceDocumentCommand`/SyncRoom (tăng documentClock, không bypass DB) ✓. Thiếu: camera trong export saved-doc (= M12 ở Phần 1); round-trip không thể giữ đủ "mọi element type" chừng nào triangle/polygon/image chưa có `ShapeUtil`. |
| **P4-05** export PNG/SVG/Excalidraw/draw.io | Chưa bắt đầu | Không có code export PNG/SVG hay importer nào ngoài native. |
| **P4-06** Asset storage adapter | Chưa bắt đầu | Không có model `Asset` trong Prisma, không có storage adapter; chỉ có `collectAssetMetadata` nhét `{id, src}` vào file export. |
| **P4-07** Version history | Chưa bắt đầu | Không có model `Snapshot`, không có `SNAPSHOT_LIST`/`SNAPSHOT_RESTORE`/`ROOM_RESTORED` trong `@vdt/shared`. |
| **P5** legacy removal | Phần lớn đạt | Saved room bị chặn `ELEMENT_UPDATE` cứng ở server (`element-update.ts:47-53`); client mutation hook chỉ đi `SYNC_COMMAND`; `applyRemoteElements` còn lại đúng vai trò local/cross-tab + nhận legacy broadcast (có comment phạm vi ✓). Thiếu so với P5-07: `hasMore`/`nextFromClock` pagination và `MAX_DIFF_BYTES` chưa implement (diff luôn `hasMore: false` — `room-diff.ts:150`); phòng lớn sẽ trả diff/snapshot một cục. P5-06 (durability tiering, conditional clock, ProcessedRequest theo resendable + GC) đã có code thật — trừ bug H4 ở Phần 1. |

---

## Đã xác nhận OK (không phải lỗi, không cần fix)

- **P3C draft re-render isolation**: `Whiteboard` không subscribe draft point-heavy trực tiếp,
  `DraftLayer` subscribe riêng, `CommittedElement` có `memo` (kiểm chứng: draft mới đổi reference
  nhưng key string `hiddenDraftIds` không đổi → bail out).
- Wheel listener có `{ passive: false }` và cleanup đúng; xử lý đủ 3 case (pinch trackpad `ctrlKey`
  → zoom quanh con trỏ, 2-finger pan → pan cả 2 trục có normalize deltaMode LINE/PAGE, Cmd/Ctrl+wheel
  → zoom); `preventDefault` gọi vô điều kiện — không phát hiện leak.
- Công thức `screenToWorld`/`worldToScreen`/pivot-zoom đúng và được test kỹ (round-trip, biên
  MIN/MAX zoom — `camera.test.ts`, `zoom-pan.test.ts`).
- Space-pan có guard text-editing ✓.
- P5 saved-room write path đã chặn legacy `ELEMENT_UPDATE` cho persisted room.
- `ProcessedRequest` có GC và được start ở backend entrypoint (dù logic GC gây ra H4).
- Redis, asset storage adapter, và version-history `Snapshot` chưa bắt đầu theo code hiện tại
  (khớp với Phần 2).
- Không có race giữa 2 cơ chế debounce localStorage (khác key, không chạy đồng thời).
- Case chưa được test nào bắt: pinch với `metaKey` thay vì `ctrlKey`, `deltaMode !== 0`, và camera
  nhận từ nguồn ngoài (localStorage/socket) — trùng đúng các chỗ có bug (M4/M7 ở Phần 1... xem thêm
  camera clamp ở nhóm HIGH).
