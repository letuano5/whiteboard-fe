# Realtime Collaborative Tactical Whiteboard — Đặc tả yêu cầu (SRS)

|               |                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------ |
| **Phiên bản** | 0.4                                                                                        |
| **Ngày**      | 2026-07-02                                                                                 |
| **Phạm vi**   | Đồ án web collaborative whiteboard, đồng bộ realtime nhiều người trên một canvas/bản đồ số |

> **Ghi chú v0.2:** restructure lộ trình để không bị ngợp — tách Phase 1 thành P1A/P1B, tách Phase 3 thành P3A/P3B/P3C, thêm Phase 0 foundation; bổ sung **mutation pipeline** và tách **committed vs transient state**; đưa undo/redo và optimistic update lên sớm; tách `image` khỏi Canvas overlay.
>
> **Ghi chú v0.3:** bổ sung Phase 4 cho workspace/document management, sharing/public/private access, admission control, import/export, version history/rollback; đẩy các phần sync polish/advanced canvas/refactor xuống các phase sau.
>
> **Ghi chú v0.4:** Phase 5 được thay bằng một refactor sync/import/export thống nhất: đập bỏ các đường sync cũ phân mảnh (`ELEMENT_UPDATE`, whole-element LWW, DB write/import/restore bypass), đưa toàn bộ write document vào module backend `SyncRoom` server-authoritative với `SyncCommand`, `SlotPatch`, `CommittedChangeSet`, `documentClock`, `roomEpoch`, idempotency và persistence transaction. Bỏ các sub-phase ack/rebase lẻ tẻ và section refactor future cũ.
>
> **Các sub-phase (P1A, P1B, P2.5, P3A…) là thứ tự triển khai (thứ tự tấn công), KHÔNG phải các milestone chấm điểm riêng.**

---

## 1. Tổng quan

Ứng dụng web cho phép nhiều người cùng vẽ và thao tác trên một bề mặt vẽ vô hạn (infinite canvas), đồng bộ realtime qua WebSocket, lưu được dữ liệu và khôi phục sau reload/reconnect.

### 1.1 Tech stack

| Tầng                    | Lựa chọn                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                | React + TypeScript + Vite                                                                                                                            |
| Render (P1–P2.5)        | **SVG/DOM-first** — mỗi shape là một node trong layer transform theo camera. **Image cũng render bằng SVG `<image>`/DOM `<img>`, không cần Canvas.** |
| Render (P3C+)           | Bổ sung **một lớp Canvas overlay** chỉ cho freehand/highlighter/eraser (point-heavy/ink)                                                             |
| State client            | Zustand — tách rõ `elements` (committed) và `interaction` (transient)                                                                                |
| Shared types            | `packages/shared/src/index.ts` — single source of truth, import qua `@vdt/shared` workspace link                                                     |
| Transport realtime      | Socket.IO client                                                                                                                                     |
| **[BE]** Server         | Node + TypeScript + Express + Socket.IO; state phòng in-memory (authoritative-light)                                                                 |
| Lưu trữ (P1)            | `localStorage` + `BroadcastChannel` (đồng bộ giữa các tab)                                                                                           |
| **[BE]** Lưu trữ (P3A+) | PostgreSQL + Prisma                                                                                                                                  |
| **[BE]** Lưu trữ (P3D+) | Redis (shared room state + Socket.IO adapter) + write-behind → PostgreSQL                                                                            |
| Conflict resolution     | P1–P4 tạm dùng whole-element LWW; P5 thay bằng server-authoritative slot-level LWW qua `SyncRoom`                                                    |

### 1.2 Nguyên tắc kiến trúc xuyên suốt

1. **Unified element store** — mọi đối tượng là một `Element` trong cùng store; renderer chỉ là cách hiển thị.
2. **Versioning từng element là legacy trước P5** — P1–P4 có thể dùng `version/versionNonce` cho sync tạm thời; từ P5 conflict source chính là `documentClock`, `roomEpoch` và slot clocks do server stamp.
3. **Shared camera transform** — mọi layer (DOM/SVG/Canvas overlay) dùng chung camera `{x, y, zoom}`.
4. **ShapeUtil (strategy)** — mỗi `type` là một module khai báo render / hit-test / resize / export riêng; core không biết chi tiết từng loại.
5. **Sync data, không sync renderer** — qua mạng chỉ truyền document command/change-set hoặc snapshot data; renderer không nằm trong protocol.
6. **Mutation pipeline duy nhất** — mọi thay đổi element đi qua một API chung (xem §3.1), không rải rác.
7. **Tách committed vs transient state** — chỉ committed state mới được lưu/sync; tương tác tạm thời nằm riêng (xem §3.2).
8. **Backend `SyncRoom` là authoritative path từ P5** — mọi write vào saved document, gồm realtime edit, import, restore, replace document, delete, binding repair và persistence, phải đi qua cùng module sync/import/export; không có DB write bypass hoặc thuật toán merge song song.

---

## 2. Mô hình dữ liệu

### 2.1 Element

```ts
type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'text' // P1A
  | 'diamond'
  | 'triangle'
  | 'polygon' // P1B
  | 'arrow' // P2
  | 'image' // P2.5 (render SVG/DOM, KHÔNG cần Canvas)
  | 'freehand'
  | 'highlighter' // P3C (Canvas overlay)
  | 'frame'
  | 'sticky'
  | 'embed'; // future polish

interface Element {
  id: string;
  type: ElementType;
  x: number;
  y: number; // world, góc trên-trái bbox
  width: number;
  height: number;
  angle: number; // radian (P1A luôn = 0; P1B tổng quát hoá)
  zIndex: number; // số nguyên (MVP). // later: index: string (fractional) nếu reorder nhiều trong collab
  props: ElementProps;

  version: number; // legacy P1-P4 sync metadata; P5 không dùng làm conflict source chính
  versionNonce: number; // legacy P1-P4 sync metadata
  updatedAt: number;
  isDeleted: boolean;

  groupId: string | null;
  frameId: string | null;
  locked: boolean;
  createdBy: string;
}

interface ElementProps {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  opacity: number;
  roughness?: number;
  points?: [number, number][]; // line, arrow, freehand, highlighter
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  src?: string; // image
  startBinding?: string | null;
  endBinding?: string | null; // arrow
  url?: string; // embed
}
```

### 2.2 Camera

```ts
interface Camera {
  x: number;
  y: number;
  zoom: number;
} // zoom clamp [0.1, 8]
```

### 2.3 Transient interaction state (KHÔNG lưu, KHÔNG sync)

```ts
type ResizeHandleId = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

interface ResizeSession {
  originalBounds: Rect;
  originalHandle: ResizeHandleId;
  anchor: Point;
}

interface InteractionState {
  tool: ToolId;
  selectedIds: string[];
  draggingId: string | null;
  dragStart: { x: number; y: number } | null;
  draftElement: Element | null; // preview đang vẽ/move/resize
  marquee: Rect | null; // khung chọn
  resizeHandle: ResizeHandleId | null;
  resizeSession: ResizeSession | null; // original bounds + handle + fixed anchor
  laserTrail: Point[]; // ephemeral
  remoteCursors: Map<string, Presence>; // từ P2
}
```

### 2.4 Presence (ephemeral — từ P2)

```ts
interface Presence {
  sessionId: string;
  userId?: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null; // world
  selectedIds: string[];
  status: 'active' | 'idle' | 'away';
  viewport?: { x: number; y: number; zoom: number };
}
```

### 2.5 Lưu trữ server (P3A+) — [BE]

> Schema này implement ở backend repo. Frontend chỉ cần biết để hiểu shape của snapshot nhận được.

```prisma
model Room {
  id                            String      @id @default(uuid()) @db.Uuid
  name                          String      @default("Untitled")
  ownerId                       String?     // FK → User, thêm ở P3B
  documentClock                 BigInt      @default(0)
  roomEpoch                     BigInt      @default(0) // P5: tăng khi replace document/import/restore
  tombstoneHistoryStartsAtClock BigInt      @default(0)
  createdAt                     DateTime    @default(now())
  updatedAt                     DateTime    @updatedAt
  members    RoomMember[]
  records    Record[]
  tombstones Tombstone[]
  slotClocks RecordSlotClock[]
  processedRequests ProcessedRequest[]
}

model RoomMember {
  roomId String @db.Uuid
  userId String
  role   String // 'owner' | 'editor' | 'viewer'
  room   Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@id([roomId, userId])
}

// Một row = một Element đang sống (chưa bị xóa).
// Khi element bị xóa: xóa row này, insert Tombstone.
model Record {
  roomId      String @db.Uuid
  recordId    String // = Element.id
  typeName    String // = Element.type
  state       Json   // toàn bộ Element object
  recordClock BigInt
  room        Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@id([roomId, recordId])
  @@index([roomId, recordClock])
}

// Ghi nhớ element đã bị xóa để reconnecting client biết cần xóa — không resurrect shape cũ.
model Tombstone {
  roomId       String @db.Uuid
  recordId     String
  deletedClock BigInt
  room         Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@id([roomId, recordId])
  @@index([roomId, deletedClock])
}

// P5+: clock theo conflict slot, dùng để merge slot-level.
model RecordSlotClock {
  roomId        String @db.Uuid
  recordId      String
  slot          String
  clock         BigInt
  lastActorId   String?
  lastRequestId String?
  room          Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@id([roomId, recordId, slot])
  @@index([roomId, clock])
}

// P5+: idempotency cho retry/reconnect, tránh apply lại cùng command.
model ProcessedRequest {
  roomId      String   @db.Uuid
  actorId     String
  requestId   String
  payloadHash String
  serverClock BigInt
  ack         Json
  createdAt   DateTime @default(now())
  room        Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@id([roomId, actorId, requestId])
  @@index([roomId, serverClock])
}
```

> Bảng `Snapshot` (version history / checkpoint) dời sang **P4-07**.
>
> **Invariant:** `documentClock` chỉ tăng, không bao giờ giảm. Mỗi accepted command tăng clock
> đúng một lần rồi gán `recordClock/deletedClock/slotClock = documentClock` cho toàn bộ phần state
> bị chạm trong command đó.

---

## 3. Kiến trúc thực thi (cần có từ Phase 0)

### 3.1 Mutation pipeline

Mọi thay đổi element **bắt buộc** đi qua một API duy nhất; không nơi nào tự ý sửa `elements`.

```ts
createElement(el);
patchElement(id, patch);
deleteElements(ids); // soft delete: isDeleted = true
updateElements(patches); // batch
```

Trong API này tập trung xử lý: tạo before/after state, capture history (cho undo), persist local,
và emit mutation event cho sync layer. P1–P4 có thể tiếp tục tăng `version/versionNonce` để phục vụ
legacy whole-element sync. Từ P5, pipeline phải sinh `SyncCommand`/`SlotPatch` từ before/after
thay vì gửi nguyên `Element[]` làm authoritative network payload.

### 3.2 Apply-remote path dùng chung (legacy P1-P4)

Có **một** hàm áp thay đổi từ "bên ngoài" (tab khác qua `BroadcastChannel`, hoặc peer qua Socket.IO) vào store theo LWW:

```ts
applyRemoteElements(incoming: Element[])  // LWW theo version/versionNonce; bỏ qua element đang sửa cục bộ
```

→ Cross-tab sync ở **P1B** và network sync ở **P2** dùng chung hàm này. Đây là path tạm để build
MVP sớm; P5 phải xóa vai trò authoritative của nó khỏi saved-room sync.

### 3.3 Unified sync/import/export module (P5 target)

Từ P5, saved document chỉ có một authoritative write path:

```txt
local mutation
  -> optimistic local state
  -> SyncCommand
  -> room actor serialized execution
  -> server SyncRoom
  -> PlannedChangeSet
  -> DB transaction
  -> CommittedChangeSet
  -> apply to room memory
  -> ack/broadcast
  -> client materialize server truth
```

Những contract cũ cần bị thay trong saved-room path:

```txt
ELEMENT_UPDATE: Element[]
whole-element version/versionNonce conflict
applyRemoteElements(Element[]) as final network merge
DB write bypass SyncRoom
```

Thay bằng:

```txt
CREATE_ELEMENT / PATCH_SLOTS / UPDATE_ARROW_BINDING / DELETE_ELEMENTS / REPLACE_DOCUMENT
server-authoritative documentClock
roomEpoch for replace-document boundaries
slot clocks
CommittedChangeSet
server ack/reject/rebase
ROOM_SNAPSHOT / ROOM_DIFF based on documentClock
```

---

## 4. Phase 0 — Foundation

**Chủ đề:** dựng bộ khung mà mọi phase sau dựa vào.

### [P0-01] Khung dự án & shared types

- [ ] Khởi tạo frontend project (Vite + React + TypeScript + Zustand + Tailwind CSS).
- [ ] Sử dụng shared types.

### [P0-02] Store & camera utils

- [ ] Zustand store tách `elements` (committed) và `interaction` (transient) theo §2.
- [ ] `screenToWorld` / `worldToScreen` chính xác ở mọi zoom.

### [P0-03] ShapeUtil registry & layer render cơ bản

- [ ] Registry ánh xạ `type → ShapeUtil` (render/hitTest/resize).
- [ ] Một layer SVG/DOM render danh sách element theo camera transform.

### [P0-04] Mutation pipeline

- [ ] Có `createElement/patchElement/deleteElements/updateElements` theo §3.1.
- [ ] **Mọi** thay đổi element đi qua đây (không sửa store trực tiếp ở nơi khác).
- [ ] Có hook chỗ để cắm history / persist / broadcast (ban đầu để rỗng).

---

## 5. Phase 1A — Local editor skeleton (MVP chạy được)

**Chủ đề:** vẽ–sửa–zoom/pan offline, chưa rotate, chưa sync. Giả định `angle = 0` để hit-test/resize đơn giản.

### [P1A-01] Tạo shape: Rectangle, Ellipse, Line, Text

**FR:** Chọn tool rồi kéo để tạo shape; thêm vào store qua mutation API.

- [ ] Mỗi tool tạo đúng `type`; shape mới có `version=1`, `versionNonce` random, `zIndex = max+1`.
- [ ] Tạo qua `createElement` (không bypass pipeline).

### [P1A-02] Select (angle = 0)

**FR:** Click trúng shape để chọn; hiện bounding box + handle.

- [ ] Hit-test ưu tiên `zIndex` cao hơn khi chồng nhau.
- [ ] Click vùng trống bỏ chọn; trạng thái chọn nằm trong transient state.

### [P1A-03] Move / Resize cơ bản / Delete

**FR:** Di chuyển, resize theo trục (chưa xét xoay), xoá.

- [ ] Move cập nhật `x,y`; resize cập nhật `width,height` (+`x,y` khi kéo cạnh trái/trên).
- [ ] Resize-with-flip: khi kéo handle vượt qua cạnh/corner đối diện, anchor đối diện giữ cố định, logical handle đổi sang phía tương ứng; bbox luôn chuẩn hoá với `width,height > 0` (không lưu kích thước âm).
- [ ] Point geometry (ví dụ line) phải mirror theo trục flip để nét vẽ, hit-test, bbox và handle tiếp tục khớp nhau.
- [ ] Delete (Del/Backspace) → `deleteElements` (soft delete).

### [P1A-04] Style cơ bản

**FR:** Sửa stroke color/fill/width/opacity của shape đang chọn.

- [ ] Đổi thuộc tính qua `patchElement`, phản ánh ngay lên render.

### [P1A-05] Text cơ bản

**FR:** Tạo text, đặt size/font/align (auto-bbox để P1B).

- [ ] Đổi `fontSize/fontFamily/textAlign` cập nhật render.
- [ ] Đổi `fontFamily` phải đo lại text và cập nhật bbox khít theo font mới, bao gồm cả nới ra khi font rộng hơn và co lại khi font hẹp hơn.

### [P1A-06] Zoom + Pan + Infinite canvas

- [ ] Cuộn/nút thay đổi `zoom` quanh con trỏ, clamp [0.1, 8].
- [ ] Pan ra xa vẫn truy cập shape ở toạ độ world bất kỳ.

### [P1A-07] Detail panel

**FR:** Chọn shape → panel hiển thị + cho sửa thuộc tính.

- [ ] Sửa trong panel cập nhật realtime (qua `patchElement`).

### [P1A-08] Toolbar cơ bản

- [ ] Có: select, hand/pan, rectangle, ellipse, line, text; tool đang chọn nổi bật.

### [P1A-09] localStorage (single tab)

**FR:** Lưu `elements + camera` vào localStorage, khôi phục khi reload.

- [ ] Ghi debounce ~300ms sau thay đổi; reload khôi phục đúng scene.

### [P1A-10] z-order nền tảng

- [ ] Thứ tự render theo `zIndex`; shape mới `= max+1`; hit-test ưu tiên `zIndex` cao. (UI reorder để P2.5.)

### [P1A-11] Back to content & Trackpad support

- [ ] Khi user pan/zoom ra vùng trống, nếu không còn thấy content nào trên viewport thì hiển thị nút Back to content ngay phía trên toolbar, có khoảng hở nhỏ và không đè lên toolbar. Khi bấm Back to content, tự động đưa camera về vị trí và zoom sao cho fit vừa đủ toàn bộ content hiện có trên canvas, có padding nhẹ, không bị crop. Nếu canvas chưa có content thì không hiển thị nút này.
- [ ] Cải thiện zoom bằng trackpad: giảm sensitivity để zoom chậm và mượt hơn, không bị phóng quá nhanh.
- [ ] Hỗ trợ pan bằng trackpad: khi scroll/lăn 2 chiều thì canvas di chuyển theo deltaX / deltaY; còn pinch hoặc Ctrl/Cmd + wheel thì vẫn xử lý là zoom.
- [ ] Khi ở chế độ Select, hiển thị hint nhỏ: “Click chuột giữa để scroll canvas”.

---

## 6. Phase 1B — Local editor polish

**Chủ đề:** thêm geometry khó và sync 2 tab. Tổng quát hoá cho shape đã xoay.

### [P1B-01] Rotate + Resize đúng khi đã xoay

- [ ] Rotate cập nhật `angle` (xoay quanh tâm bbox).
- [ ] Resize/hit-test đúng cả khi `angle ≠ 0` (un-rotate điểm theo `-angle` trước khi test).

### [P1B-02] Diamond / Triangle / đa giác

- [ ] Tạo qua toolbar; dùng chung move/resize/rotate; chỉ cần thêm ShapeUtil mới.

### [P1B-03] Double-click sửa text + auto-bbox

- [ ] Double-click mở ô chỉnh tại chỗ (contenteditable trong layer transform).
- [ ] Blur/Esc commit vào `props.text` (qua `patchElement`); bbox co theo nội dung.
- [ ] Auto-bbox cũng áp dụng cho đổi font trong detail panel: bbox phải khít lại theo kích thước text sau khi đổi `fontFamily`, không để tràn và không giữ bbox cũ quá rộng.

### [P1B-04] Laser pointer (local, transient)

- [ ] Vệt laser nằm trong `interaction.laserTrail`, không vào `elements`; tự mờ/biến mất.

### [P1B-05] Cross-tab sync (BroadcastChannel)

**FR:** Thay đổi ở tab này hiện ở tab khác cùng trình duyệt, qua `applyRemoteElements` (§3.2).

- [ ] Mở 2 tab: thay đổi tab A xuất hiện tab B.
- [ ] Dùng LWW (version/nonce) để hoà giải; **dùng đúng hàm apply-remote sẽ tái dùng ở P2.**

### [P1B-06] Undo / Redo (local)

**FR:** Hoàn tác/làm lại dựa trên history bắt từ mutation pipeline.

- [ ] Ctrl/Cmd+Z / Shift+Z; mỗi bước lưu inverse patch.
- [ ] Khi apply undo/redo cũng `version++` (để hợp lệ khi sync sau này).

---

## 7. Phase 2 — Realtime MVP

**Chủ đề:** nhiều người một phòng, thấy con trỏ và thay đổi của nhau realtime. Server in-memory + LWW. Sync local trước rồi broadcast (optimistic ngầm).

### [P2-01] Room + join + share link

- [ ] Client gửi `join-room` theo `roomId` khi mount.
- [ ] UI tạo phòng mới / sao chép link; routing mở đúng phòng từ URL.
- [BE] Server xử lý `join-room`; quản lý danh sách phòng in-memory; chỉ broadcast trong cùng phòng.

### [P2-02] Realtime broadcast (reuse apply-remote)

- [ ] Sau mutation → gửi element (đã `version++`) lên server qua socket.
- [ ] Nhận event từ server → `applyRemoteElements` (cùng hàm P1B); render < ~200ms.
- [BE] Server nhận element từ client → broadcast cho toàn phòng (trừ sender).

### [P2-03] Optimistic local update

- [ ] Thao tác áp ngay cục bộ, không chờ server (cảm giác tức thì). (Ack/rebase nâng cao → P5.)

### [P2-04] LWW conflict (version + nonce)

- [ ] `applyRemoteElements` áp LWW: `version` cao hơn thắng; hoà thì `versionNonce` nhỏ hơn thắng (deterministic).
- [ ] Mọi client hội tụ cùng một state.

### [P2-05] Từ chối remote khi đang sửa

- [ ] Element đang kéo/resize/sửa cục bộ bỏ qua remote update giữa chừng; kết thúc thì hội tụ theo LWW.

### [P2-06] Live cursor + tên/màu

- [ ] Throttle cursor position (~33ms) → gửi lên server ở toạ độ world; ephemeral (không vào `elements`).
- [ ] Nhận cursor của người khác → render nhãn tên + màu.
- [BE] Server relay cursor event trong phòng (không lưu).

### [P2-07] Danh sách user online

- [ ] Nhận danh sách user online từ server; render UI; cập nhật khi join/leave.
- [BE] Server broadcast join/leave event cho phòng.

### [P2-08] Multi-select + Duplicate/Copy-Paste

- [ ] Marquee + shift-click; move/style/delete áp cả tập chọn.
- [ ] Ctrl/Cmd+D / C / V hoạt động với một và nhiều shape.

### [P2-09] Arrow cơ bản + Stroke style

- [ ] Vẽ arrow 2 điểm có đầu mũi tên (binding → P2.5).
- [ ] `strokeStyle` solid/dashed/dotted.

---

## 8. Phase 2.5 — Tính năng hữu ích cho tactical board

**Chủ đề:** những thứ làm whiteboard "dùng được thật" cho bản đồ chiến thuật. (Image render SVG/DOM, **không** cần Canvas.)

### [P2.5-01] Image / bản đồ nền

- [ ] Chèn ảnh qua URL hoặc upload base64; render `<image>` SVG / `<img>` DOM.
- [ ] Move/resize được; đặt làm lớp dưới cùng.

### [P2.5-02] Z-order UI

- [ ] Bring-to-front / send-to-back / forward / backward cập nhật `zIndex`; đồng bộ giữa client.

### [P2.5-03] Arrow binding

- [ ] Đầu arrow thả gần shape → lưu `startBinding/endBinding`; di chuyển shape thì arrow bám theo.

### [P2.5-04] Thấy selection của người khác

- [ ] `selectedIds` trong presence; shape người khác đang chọn hiện viền màu của họ.
- [ ] Khi user khác thay đổi element trên canvas/document, client hiện tại phải thấy được thay đổi realtime đó. Thay đổi realtime có thể là draft/pending change, chưa cần coi là thay đổi đã commit vào document. Chưa cần xử lý conflict phức tạp; mục tiêu chính là hiển thị được selection và preview thay đổi của người khác.
- [ ] Nếu element đang selected có remote draft cùng id, bbox selection phải bám draft thay vì committed element; bbox remote draft/selection phải xoay theo `angle`.

### [P2.5-05] Point-based model cho linear elements (arrow, line, freehand)

**Vấn đề:** `arrow` và `line` hiện lưu cả `x,y,width,height` (bbox) lẫn `props.points` (điểm thực). Hai nguồn sự thật này có thể diverge — bbox không cập nhật khi binding hook đổi points, resize theo bbox làm arrow "biến dạng" không trực quan. Freehand (P3C) sẽ gặp vấn đề tương tự nếu không sửa sớm.

**Mục tiêu:** Linear elements (arrow, line, freehand) chuyển sang **point-based model**: `props.points` là nguồn sự thật duy nhất; `x,y,width,height` luôn được derive từ points (bounding box của tập điểm), không bao giờ được lưu độc lập.

- [ ] `getBounds` của arrow/line ShapeUtil tính bbox từ `props.points` thay vì dùng `x,y,width,height`.
- [ ] Khi commit mutation, pipeline tự chuẩn hoá `x,y,width,height` của linear elements theo bbox của points (helper `normalizeLinearBounds`).
- [ ] Selection UI cho arrow/line hiển thị **endpoint handles** (vòng tròn kéo được tại mỗi điểm đầu/cuối) thay vì 8 bbox corner/edge handles.
- [ ] Kéo endpoint handle cập nhật đúng điểm đó trong `props.points`; snap binding vẫn hoạt động khi thả.
- [ ] **Arrow bám theo khi drag (draft mode):** trong `onSelectPointerMove`, khi tính draft position cho các element đang được kéo, tìm thêm các arrow có `startBinding`/`endBinding` tới chúng và đưa arrow đó (với points đã cập nhật) vào `draftElements` — để arrow di chuyển theo ngay khi kéo, không chờ đến `pointerUp`.
- [ ] Hit-test và undo/redo không bị ảnh hưởng.

### [P2.5-06] Elbow arrow routing tránh source/target shape

- [ ] Arrow/connector hỗ trợ chế độ **elbow/orthogonal routing**: path gồm các đoạn ngang/dọc, được lưu dưới dạng danh sách `points`.
- [ ] Arrow có thể bind vào 2 element:
  - `startBinding?: { elementId, anchorRatio }`
  - `endBinding?: { elementId, anchorRatio }`
- [ ] Khi arrow bind vào source/target element, điểm đầu/cuối của arrow phải nằm trên hoặc gần outline của element, không nằm sâu bên trong shape.
- [ ] Chỉ cần tránh **source element** và **target element**. Chưa cần tránh các shape không liên quan nằm giữa đường nối.
- [ ] Source/target shape được coi là obstacle bằng `boundingBox + padding`.
- [ ] Router tính path theo hướng **orthogonal/Manhattan**.
- [ ] Router ưu tiên theo thứ tự:
  1. Simple orthogonal path nếu không cắt source/target bbox.
  2. Thêm đoạn “dongle” ngắn đi ra ngoài source/target shape trước khi bẻ hướng.
  3. Nếu path đơn giản vẫn lỗi, dùng **A\*** trên sparse grid để tìm đường orthogonal tránh source/target bbox.
- [ ] A\* chỉ được đi 4 hướng:
  - left
  - right
  - up
  - down
- [ ] Cost function của A\* nên ưu tiên:
  - đường ngắn hơn
  - ít góc gấp hơn
  - không đi xuyên `boundingBox + padding` của source/target
- [ ] Sau khi tìm được path, cần simplify points:
  - bỏ điểm trùng nhau
  - bỏ đoạn quá ngắn
  - bỏ điểm trung gian thẳng hàng
- [ ] Khi user di chuyển source hoặc target shape, các arrow bind với shape đó phải reroute.
- [ ] Khi user kéo một đầu arrow sang shape khác, binding của đầu đó được cập nhật và path được tính lại.
- [ ] Không cần xử lý obstacle là shape không liên quan.
- [ ] Không cần reroute khi user di chuyển shape không phải source/target.
- [ ] Không cần routing toàn cục giữa nhiều arrow.

---

## 9. Phase 3A — Persistence & reconnect

**Chủ đề:** chuyển nguồn sự thật lên server + DB; reload/reconnect không mất dữ liệu.

### [P3A-01] PostgreSQL + Prisma + autosave — [BE]

- [BE] Prisma schema theo §2.5: `Room`, `RoomMember`, `Record`, `Tombstone`.
- [BE] Autosave throttle ~5–10s và ngay khi phòng trống (0 client):
  - Mỗi write transaction: tăng `documentClock` một lần, upsert từng element vào `Record` với `recordClock = documentClock`.
  - Element bị xóa (`isDeleted = true`): xóa row `Record`, insert `Tombstone` với `deletedClock = documentClock`.
- [BE] In-memory `roomElements` vẫn là authoritative hot path; DB là backing store cho durability.

### [P3A-02] Load khi mở phòng

- [ ] Client nhận `ROOM_SNAPSHOT { elements, documentClock }` khi join; P3A áp qua `applyRemoteElements`, P5 thay bằng snapshot hydration của sync client; lưu `lastServerClock = documentClock`.
- [ ] Phòng chưa có dữ liệu → `elements: [], documentClock: 0`.
- [BE] Server query `Record WHERE roomId = ?` và gửi snapshot kèm `documentClock` hiện tại.

### [P3A-03] Reconnect không mất data

- [ ] Socket.IO tự reconnect; client gửi `lastServerClock` khi reconnect.
- [ ] Client áp diff nhận về: upsert `changed` elements, xóa `deleted` khỏi store; P3A có thể dùng `applyRemoteElements`, P5 phải apply slot-aware theo `ROOM_DIFF`.
- [ ] Thay đổi cục bộ chưa kịp gửi: P3A gửi lại qua `ELEMENT_UPDATE`; P5 replay pending `SyncCommand` sau khi hydrate server state.
- [BE] Nhận `lastServerClock` từ client, trả về:
  - Bình thường (`lastServerClock >= tombstoneHistoryStartsAtClock`): diff `{ changed: Record[], deleted: Tombstone[], documentClock }` — chỉ những gì thay đổi sau `lastServerClock`.
  - Clock quá cũ (`lastServerClock < tombstoneHistoryStartsAtClock`): wipe_all — trả full snapshot như P3A-02.

### [P3A-04] Delta push theo clock

- [BE] P3A: sau mỗi `ELEMENT_UPDATE` nhận vào, tăng `documentClock` một lần cho cả batch, gán `recordClock = documentClock`; persist throttled vào DB.
- [BE] P5: xóa `ELEMENT_UPDATE` khỏi saved-room write path; mỗi accepted `SyncCommand` tăng `documentClock` một lần trong DB transaction rồi stamp `recordClock/deletedClock/slotClock`.
- [ ] Client không cần track `version đã gửi` per element — clock trên server quản lý.
- [ ] `lastServerClock` client cập nhật mỗi khi nhận ack hoặc patch từ server.
- [BE] Bỏ full-resync định kỳ — clock-based diff đã đủ. Nếu phát hiện drift, P5 dùng gap detection + `ROOM_DIFF`/`ROOM_SNAPSHOT`, không thêm đường sync song song.

---

## 10. Phase 3B — Auth & permission

**Chủ đề:** danh tính + phân quyền (tách khỏi persistence để giảm rủi ro). Yêu cầu: Thiết kế provider-agnostic để có thể đổi hoặc thêm auth provider khác (Supabase self-hosted, Firebase, OIDC/custom provider) mà không viết lại authorization/domain logic.

### [P3B-00] Supabase Auth integration foundation

P3B-00 là một cụm foundation lớn, triển khai theo các slice độc lập dưới đây thay vì làm
một lần. Mục tiêu chung: chọn Supabase self-hosted làm auth provider đầu tiên, nhưng backend
vẫn đi qua abstraction kiểu `AuthVerifier`/provider adapter để domain code không phụ thuộc trực
tiếp vào Supabase SDK/API.

#### [P3B-00a] Supabase local compose foundation

Clone Repo chính thức tại: https://github.com/supabase/supabase/tree/master/docker. Sử dụng docker-compose.yml làm đối tượng chính.

- [ ] Sparse-clone/copy nguyên thư mục `docker/` chính thức của Supabase để giữ đủ init files (`volumes/db/*.sql`), rồi tạo compose tối giản cho project.
- [ ] P3B mặc định giữ Supabase `db` + `auth` + `kong` để frontend dùng `@supabase/supabase-js` theo URL chuẩn (`/auth/v1`) và giảm code auth tự viết.
- [ ] Dùng `supabase/postgres:17.6.1.136` thay cho `postgres:latest`.
- [ ] Pin image `auth` theo compose chính thức được copy vào repo.
- [ ] Cập nhật env mẫu cho Supabase local (`SUPABASE_PUBLIC_URL`, anon/service keys, JWT secret, DB URL qua Supabase Postgres).
- [ ] Không xóa hoặc rebuild data dir trong slice này.

#### [P3B-00b] Backend auth abstraction skeleton

- [ ] Tạo contract backend cho `AuthVerifier` và identity chuẩn hóa (`provider`, `providerSubject`, `email`, `name`, `avatarUrl`).
- [ ] Tạo provider adapter/stub để các middleware/handler sau này gọi qua abstraction, không gọi trực tiếp Supabase SDK/API trong domain code.
- [ ] Không attach auth vào socket/HTTP request thực tế trong slice này; phần đó thuộc [P3B-01].
- [ ] Thêm test tập trung cho verifier contract hoặc stub behavior.
- [ ] JWT chỉ chứng minh identity; room authorization vẫn dùng dữ liệu app (`RoomMember.role`) làm nguồn sự thật.

#### [P3B-00c] Local DB reset and app-user boundary docs

- [ ] Ghi rõ quy trình rebuild toàn bộ DB local/dev từ Supabase Postgres sạch: bỏ physical data dir cũ (`.data/postgres`), tạo volume/data dir mới, rồi chạy lại Prisma migrations.
- [ ] Không tự động chạy lệnh phá dữ liệu trong code/scripts nếu chưa có xác nhận rõ ràng từ người phát triển.
- [ ] Không modify trực tiếp bảng `auth.users`; nếu app cần thông tin user/profiles, tạo bảng app riêng trong schema `public` và sync/upsert bằng backend/Prisma sau khi verify token.
- [ ] Room authorization không đọc trực tiếp từ JWT; role được resolve từ dữ liệu app (`RoomMember.role`).

### [P3B-01] Auth đăng nhập

- [ ] UI login qua provider adapter; với Supabase dùng `@supabase/supabase-js` trỏ vào Kong (`SUPABASE_PUBLIC_URL`) để login, restore session, refresh token.
- [ ] Lưu/khôi phục session token; attach access token vào socket connection và HTTP requests.
- [BE] Middleware verify JWT cho socket và HTTP thông qua `AuthVerifier`, trả về identity chuẩn hóa (`provider`, `providerSubject`, `email`, `name`, `avatarUrl`).
- [BE] Sau khi verify token, upsert user nội bộ trong DB app; các bảng domain dùng user id nội bộ hoặc Supabase `sub` đã chuẩn hóa, không đọc trực tiếp `auth.users` ở business logic.

### [P3B-02] Role owner / editor / viewer

- [ ] UI ẩn toolbar/actions khi role `viewer` (UX only — không đủ để enforce).
- [ ] Owner có UI đổi role thành viên.
- [BE] **Server từ chối mutation từ session role `viewer`** (enforce ở server, không chỉ ẩn UI).
- [BE] `RoomMember.role` lưu vai trò trong DB.
- [BE] Không lưu room role trong JWT làm nguồn sự thật; role được resolve khi join room và kiểm tra lại ở mutation path.

---

## 11. Phase 3C — Canvas overlay (ink)

**Chủ đề:** thêm một lớp Canvas (DPR + `ctx.setTransform`) chỉ cho các loại point-heavy.

### [P3C-01] Canvas layer

- [ ] Canvas full-viewport, `ctx.setTransform(zoom,0,0,zoom,x,y)`, nhân `devicePixelRatio` để nét; dùng chung camera.

### [P3C-02] Freehand

- [ ] Vẽ nét tự do, lưu `props.points`; move/delete như element khác.

### [P3C-03] Highlighter

- [ ] Nét bán trong suốt, dày hơn freehand.

### [P3C-04] Eraser

- [ ] Rê qua shape → `isDeleted = true`; đồng bộ.

---

## 12. Phase 3D — Horizontal scaling (Redis)

**Chủ đề:** cho phép chạy nhiều Node.js instance song song; Redis thay thế in-process Map làm shared authoritative state.

> Phase này là optional — chỉ cần khi muốn scale ngang hoặc zero-downtime deploy. P3A–P3C không phụ thuộc vào đây.

### [P3D-01] Redis làm shared room state — [BE]

- [BE] Thay `roomElements: Map<roomId, Map<elementId, Element>>` bằng Redis Hash: `room:{roomId}:elements` → field = `elementId`, value = JSON-serialized `Element`.
- [BE] Upsert element: `HSET room:{roomId}:elements {elementId} {json}`.
- [BE] Load snapshot: `HGETALL room:{roomId}:elements`.
- [BE] Tombstone: `SREM` khỏi hash + `SADD room:{roomId}:tombstones {elementId}`.
- [BE] Redis persistence bật **AOF** (`appendfsync everysec`) để giảm cửa sổ mất data xuống ~1s.

### [P3D-02] Socket.IO Redis Adapter — [BE]

- [BE] Thêm `@socket.io/redis-adapter`; mọi `io.to(roomId).emit(...)` tự động fan-out sang tất cả instance.
- [BE] Không còn phụ thuộc vào việc client phải kết nối đúng instance.

### [P3D-03] Write-behind: Redis → PostgreSQL — [BE]

- [BE] Background job (setInterval hoặc Bull queue) flush `room:{roomId}:elements` → bảng `Record` trong PostgreSQL, throttle ~3s.
- [BE] Flush ngay khi phòng trống (0 client) và khi nhận `SIGTERM`.
- [BE] PostgreSQL vẫn là source of truth cho cold load (server restart); Redis là hot cache cho active rooms.

---

## 13. Phase 4 — Workspace, sharing & file lifecycle

**Chủ đề:** nâng whiteboard từ một "room realtime" thành document product: user có workspace/file riêng, chia sẻ có kiểm soát, giới hạn người tham gia, import/export, và rollback lịch sử.

**Prerequisite:** P3A persistence/reconnect đã chạy ổn; P3B auth + room role enforcement đã
được wire vào runtime thật (không chỉ unit test module rời). Từ P4 trở đi cần phân biệt rõ:

- **Local board**: anonymous, chỉ localStorage/BroadcastChannel, không tạo `Room` trong DB.
- **Saved document**: authenticated, có `Room` trong DB, owner/members/visibility rõ ràng.

### [P4-00] Anonymous local board + Login to save

- [ ] Người chưa đăng nhập có thể tạo board local-only và dùng một mình ngay.
- [ ] Local-only board không tạo `Room`, `Record`, `Tombstone`, `RoomMember` trong DB.
- [ ] Local-only board vẫn lưu localStorage và sync qua các tab cùng browser bằng BroadcastChannel.
- [ ] Local-only board không kết nối persistence/autosave DB; network realtime cho anonymous saved room dời sang P4-02 link/public modes.
- [ ] UI anonymous local-only board hiện import, export, và CTA `Login to save`.
- [ ] Bấm `Login to save` mở login nếu user chưa đăng nhập; sau login thành công tự tạo saved document ngay, không hỏi confirm.
- [ ] Tạo room persisted mới, copy toàn bộ elements hiện tại vào DB qua mutation/import path hợp lệ, user hiện tại là owner, room mặc định `visibility = 'private'`.
- [ ] Sau khi convert local → saved thành công, xóa local board scene khỏi localStorage để reload không resurrect bản local cũ.
- [ ] Local-only board có nút menu ở góc trái trên; bấm vào mở `/dashboard`.
- [ ] Convert local → saved không làm mất element, zIndex, version metadata, deleted/tombstone semantics cần thiết, và camera hiện tại nếu có lưu.

**Acceptance criteria:**

- [ ] Anonymous tạo board, vẽ, reload cùng browser vẫn thấy data.
- [ ] Anonymous mở tab thứ hai cùng local board, thay đổi sync qua tab.
- [ ] Anonymous local board không xuất hiện trong DB và không có room id persisted.
- [ ] `Login to save` chỉ hiện cho local-only board; saved document không hiện CTA này.
- [ ] Login thành công rồi auto-save tạo saved document với owner đúng.
- [ ] Convert local → saved giữ nguyên nội dung canvas nhìn thấy trước khi login.
- [ ] Nếu login hoặc save thất bại, local board không mất data và user thấy lỗi rõ ràng.

### [P4-01] Workspace + document dashboard

- [ ] User đã đăng nhập có dashboard liệt kê các room/document mình sở hữu, được share, và mở gần đây.
- [ ] Anonymous user không có dashboard cá nhân; chỉ có local board hiện tại và CTA login.
- [ ] Dashboard hiển thị tài liệu theo `Recent` mặc định, có preview từng document theo kiểu grid card.
- [ ] Tạo room mới từ dashboard; room mới mặc định `visibility = 'private'`, owner là user hiện tại.
- [ ] Đổi tên room/document; xóa hoặc archive room chỉ owner/admin được làm.
- [ ] Search theo tên/owner; filter chỉ gồm `All`, `Owned by me`, `Shared with me`.
- [ ] Dashboard dùng infinite scroll với keyset cursor (`updatedAt`, `id`), không dùng limit/offset pagination.
- [BE] Thêm `Workspace` và `WorkspaceMember` nếu cần nhóm nhiều document; tối thiểu P4 có thể dùng personal workspace mặc định cho mỗi user.
- [BE] Room lưu `workspaceId`, `ownerId`, `visibility`, `locked`, `archivedAt`, `lastOpenedAt`, `createdBy`.
- [BE] Query dashboard chỉ trả document mà user có quyền xem; không leak private room qua search.
- [BE] Mở document cập nhật `lastOpenedAt` cho user/session hiện tại.

**Acceptance criteria:**

- [ ] User chỉ thấy document mình sở hữu hoặc được share.
- [ ] Document được share xuất hiện trong `Shared with me`.
- [ ] Archived/deleted document không xuất hiện mặc định nhưng owner có thể xem bằng filter nếu còn retained.
- [ ] Tạo document từ dashboard mở thẳng canvas saved document với role owner.
- [ ] Rename/archive/delete bị server reject nếu actor không phải owner/admin.
- [ ] Trang đầu dashboard lấy tối đa 10 documents; các trang sau dùng cursor từ document cuối cùng để query tiếp.

### [P4-02] Sharing, public/private access, invited users

- [ ] Room hỗ trợ access mode:
  - `private`: chỉ owner và added members được vào.
  - `link_view`: public viewer — ai có link vào được với quyền viewer.
  - `link_edit`: public editor — ai có link vào được với quyền editor, trừ khi editor slots đã đầy.
- [ ] Owner có một nút `Share`; bấm vào mở modal với backdrop tối nền phía sau.
- [ ] Modal Share có 2 nhóm: add email + set role cho user, và link access (`private`, `link_view`, `link_edit`) kèm copy link.
- [ ] Modal Share hiển thị members hiện tại và role owner/editor/viewer.
- [ ] Owner add user đã tồn tại theo email với role `editor` hoặc `viewer`; email chưa có account phải bị reject rõ ràng, không tạo pending invite.
- [ ] Owner đổi role member giữa `editor` và `viewer`, remove member.
- [ ] Bản P4 đầu không hỗ trợ transfer owner; không cho owner tự hạ role hoặc remove chính mình.
- [ ] Explicit `RoomMember.role` ưu tiên hơn link role. Capacity có thể hạ quyền thành `effectiveRole` thấp hơn.
- [BE] Server quyết định `baseRole` và `effectiveRole` khi join dựa trên `RoomMember.role`, `visibility`, và room capacity.
- [BE] Tất cả HTTP/socket mutation phải check permission server-side; UI chỉ là lớp UX.
- [BE] Non-owner gọi API/socket quản lý quyền phải bị reject dù UI bị ẩn.

**Acceptance criteria:**

- [ ] Owner mở Share modal, add email của user tồn tại, đổi role, remove member thành công.
- [ ] Add email chưa tồn tại bị reject và không tạo pending invitation.
- [ ] Mở link room private nhưng không có quyền phải thấy lỗi rõ ràng; app không được render như local/new empty board.
- [ ] Chưa login thì góc phải hiện `Login`; đã login thì hiện avatar tròn, bấm avatar có ít nhất action `Sign out`, nằm bên phải nút `Share`.
- [ ] Editor/viewer không thấy action quản lý quyền hoặc thấy disabled; nếu gọi lén vẫn bị server reject.
- [ ] Existing user vào room đúng role sau khi được add bằng email.
- [ ] Viewer không thấy toolbar edit và server reject document mutation (`ELEMENT_UPDATE` ở P1-P4,
      `SyncCommand` từ P5).
- [ ] Private room từ chối user không phải owner/member.
- [ ] `link_view` cho người có link vào xem với `effectiveRole = 'viewer'`.
- [ ] `link_edit` cho người có link vào edit nếu editor slot còn.
- [ ] Revoke link làm link cũ mất quyền truy cập.

### [P4-03] Room capacity control

- [ ] Room có `maxParticipants` và `maxEditors` để tránh quá tải realtime; P4 đầu dùng in-memory presence nên chỉ đảm bảo mạnh trong một backend process.
- [ ] Owner có thể chỉnh `maxParticipants` và `maxEditors` trong Share modal; không có room-level lock/unlock trong access model.
- [ ] Capacity input phải bị giới hạn: `maxParticipants <= 50`, `maxEditors <= 10`, và `maxEditors <= maxParticipants` khi cả hai được đặt.
- [ ] Nếu phòng chưa đầy: user join theo role thật hoặc role từ link.
- [ ] Nếu editor slots đã đầy: user có quyền editor vẫn được join dưới `effectiveRole = 'viewer'`.
- [ ] Khi editor rời phòng, P4 đầu không cần queue/auto-promote; user bị hạ xuống viewer có thể reload/rejoin để claim slot mới nếu base role cho phép.
- [BE] Presence/session list phân biệt `baseRole` và `effectiveRole`.
- [BE] Server reject document mutation khi `effectiveRole` không đủ quyền. P1-P4 mutation event chính là `ELEMENT_UPDATE`; từ P5 gồm mọi `SyncCommand` như patch, delete, import/replace và restore.

**Acceptance criteria:**

- [ ] Share modal có capacity controls cho participant/editor limits và không có room lock/unlock control.
- [ ] Capacity settings reject giá trị malformed, vượt trần, hoặc `maxEditors > maxParticipants`.
- [ ] Khi `maxParticipants` đầy, user mới không join được và thấy thông báo rõ ràng.
- [ ] Khi `maxEditors` đầy, user có base role editor vẫn join dưới `effectiveRole = 'viewer'`.
- [ ] Presence/online-users UI thể hiện role hiệu lực để user hiểu vì sao toolbar bị ẩn.
- [ ] Bản P4 đầu yêu cầu rejoin/reload để nhận editor slot mới; không cần queue hay auto-promote realtime.

### [P4-04] Native file lifecycle: save/load `.vdt.json`

- [ ] Export native `.vdt.json` được cho cả local board và saved document.
- [ ] `.vdt.json` gồm schema version, room metadata tối thiểu, camera, elements, và optional assets metadata.
- [ ] Import `.vdt.json` vào local board nếu anonymous, hoặc vào saved document nếu authenticated và đủ quyền.
- [ ] Import `.vdt.json` vào room hiện tại hoặc tạo room/document mới.
- [ ] Import phải validate schema version; file lạ/thiếu field cần báo lỗi rõ ràng.
- [ ] Load file không được ghi đè room đang mở nếu user chưa confirm.
- [ ] Save/load native format phải round-trip được toàn bộ element types hiện có.
- [BE] Import vào persisted room tạo batch mutation mới và tăng `documentClock`, không ghi DB bypass mutation pipeline. Từ P5 import phải đi qua `REPLACE_DOCUMENT` hoặc command tương ứng trong unified sync module.
- [BE] Import vào persisted room phải check `effectiveRole` editor/owner trước khi mutate.

**Acceptance criteria:**

- [ ] Export rồi import lại `.vdt.json` giữ đủ element types, styles, zIndex, angle, group/frame metadata hiện có.
- [ ] Anonymous import không tạo DB room nếu user chưa chọn login/save.
- [ ] Authenticated import vào saved document bị reject nếu user là viewer.
- [ ] Import invalid schema không crash và hiển thị lý do lỗi.
- [ ] Load file vào board/document đang có data luôn có confirm trước khi thay thế hoặc merge.

### [P4-05] Cross-platform import/export

- [ ] Export PNG/SVG khớp nội dung đang thấy hoặc selection tuỳ chọn.
- [ ] Export JSON native (`.vdt.json`) là format chính để backup/migrate.
- [ ] Import Excalidraw JSON ở mức best-effort: rectangle/ellipse/line/arrow/text/image cơ bản.
- [ ] Import draw.io XML ở mức best-effort: basic shapes/connectors/text; không cam kết full fidelity.
- [ ] Unsupported styles/shapes phải degrade có kiểm soát, không crash.
- [ ] Mỗi importer trả report: số object import được, số object bị bỏ qua, lý do chính.

**Acceptance criteria:**

- [ ] Export PNG/SVG từ viewport hoặc selection tạo file khớp nội dung người dùng thấy.
- [ ] Excalidraw import tạo được rectangle/ellipse/line/arrow/text/image cơ bản nếu format hợp lệ.
- [ ] draw.io import tạo được basic shapes/connectors/text ở mức best-effort.
- [ ] Unsupported object không làm hỏng toàn bộ import; report nêu số object skipped và lý do chính.

### [P4-06] Asset metadata + storage adapter (pre-S3)

- [ ] Image/file asset không nên chỉ nhúng base64 lâu dài; cần metadata để sau này chuyển sang object storage.
- [BE] Thêm `Asset` metadata: `id`, `roomId`, `ownerId`, `mimeType`, `size`, `storageKey`, `createdAt`.
- [BE] Storage adapter interface hỗ trợ ít nhất local/dev storage; để ngỏ S3-compatible backend (S3/R2/MinIO/Supabase Storage).
- [BE] Backend check role trước khi cấp upload/read URL hoặc nhận upload.
- [ ] Element `image.props.src` có thể trỏ tới asset URL hoặc data URL; native export cần giữ đủ thông tin để restore.
- [ ] Local board vẫn có thể dùng data URL cho ảnh; chuyển sang saved document có thể migrate asset metadata sau.

**Acceptance criteria:**

- [ ] Viewer không lấy được upload URL hoặc ghi asset mới.
- [ ] Editor/owner upload image asset và chèn vào document được.
- [ ] Native export của document có asset metadata đủ để restore hoặc báo rõ asset missing.
- [ ] Local/dev storage adapter không leak file giữa room/user khác nhau.

### [P4-07] Version history (snapshot) + owner restore

**Prerequisite:** P3A (PostgreSQL + Prisma schema với `Room`, `Record`, `Tombstone` đã có). P4-03 khuyến nghị (permission/capacity đã rõ). Snapshot chỉ áp dụng cho saved document; local-only board không có server snapshot.

**Schema bổ sung vào Prisma (P4-07):**

```prisma
model Snapshot {
  id            String   @id @default(uuid()) @db.Uuid
  roomId        String   @db.Uuid
  documentClock BigInt
  createdBy     String?
  createdAt     DateTime @default(now())
  reason        String   // 'interval' | 'manual' | 'restore' | 'import'
  records       Json     // Element[] — toàn bộ elements sống tại thời điểm snapshot
  tombstones    Json     // { recordId: string; deletedClock: string }[]
  room          Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@index([roomId, createdAt])
}
```

**Trigger snapshot (server-side):**

- Sau mỗi commit batch tăng `documentClock`: nếu `now - lastSnapshotAt >= 30_000ms` và `documentClock > lastSnapshotClock` → enqueue snapshot với `reason: 'interval'`.
- Manual (user bấm nút lưu phiên bản): immediate snapshot với `reason: 'manual'`.
- Trước khi import/restore: snapshot trạng thái hiện tại với `reason: 'import'` hoặc `reason: 'restore'` (safety net).
- Retention: giữ mỗi 30s trong 1h gần nhất, mỗi 5m trong 24h, mỗi 1h trong 30 ngày.

**Protocol (`@vdt/shared` — thêm events):**

```ts
// Events mới
SNAPSHOT_LIST: 'snapshot-list'; // client request → server HTTP GET hoặc socket
SNAPSHOT_RESTORE: 'snapshot-restore'; // client → server: { roomId, snapshotId }
ROOM_RESTORED: 'room-restored'; // server → broadcast toàn phòng
```

```ts
// ROOM_RESTORED payload
interface RoomRestoredPayload {
  roomId: string;
  snapshotId: string;
  serverClock: number;
  mode: 'wipe_all';
  elements: Element[]; // toàn bộ elements từ snapshot
}
```

**Server restore transaction (P4 path; P5 thay bằng `REPLACE_DOCUMENT` command):**

1. Check user là owner/admin của room.
2. Load snapshot theo `snapshotId`.
3. Insert snapshot hiện tại với `reason: 'restore'` (safety net).
4. P4 có thể xóa toàn bộ `Record` của room, insert lại từ `snapshot.records`.
5. P4 có thể xóa toàn bộ `Tombstone`, insert lại từ `snapshot.tombstones`.
6. `Room.documentClock = max(current + 1, snapshot.documentClock + 1)`.
7. Broadcast `ROOM_RESTORED` với `mode: 'wipe_all'` và toàn bộ elements.
8. Từ P5, restore không được thao tác DB trực tiếp; phải tạo safety snapshot rồi execute `REPLACE_DOCUMENT` qua `SyncRoom`, tăng `roomEpoch`, clear pending cũ và broadcast `CommittedChangeSet`.

**Client xử lý `ROOM_RESTORED`:**

```ts
// Xóa pending queue — state cũ không còn valid
pendingPushRequests = [];
lastServerClock = data.serverClock;
// Wipe và load snapshot
useElementsStore.getState().setElements(data.elements);
```

**Acceptance criteria:**

- [ ] UI có panel liệt kê snapshots (timestamp, reason, createdBy); có nút Restore cho owner/admin.
- [ ] Restore hiển thị confirm dialog vì sẽ thay toàn bộ document state.
- [ ] Sau restore, tất cả client trong phòng nhận `ROOM_RESTORED` và hiển thị đúng state snapshot.
- [ ] `pendingPushRequests` bị clear khi nhận `ROOM_RESTORED` để tránh ghost push.
- [BE] Snapshot được tạo tự động mỗi ≥30s khi có thay đổi.
- [BE] Restore là atomic transaction — không có trạng thái partial.
- [BE] Snapshot trước restore/import được lưu để có thể quay lại nếu cần.
- [BE] Viewer/editor bị reject khi restore nếu không phải owner/admin.

### Phase 4 Definition of Done

- [ ] Mỗi slice có test tách riêng anonymous local board và authenticated saved document nếu cả hai path liên quan.
- [ ] Mọi feature permission có server-side rejection test, không chỉ UI visibility test.
- [ ] Runtime entrypoint/wiring được test hoặc có manual proof rõ ràng trước khi mark done.
- [ ] UI visibility test render qua route/app surface thực tế khi khả thi, không chỉ test component rời.
- [ ] Anonymous local-only path có test/proof rằng không tạo row DB.
- [ ] Socket và HTTP mutation paths đều check permission cho saved document.
- [ ] Không mark P4 task done nếu chỉ có module-level test mà chưa nối vào app runtime.
- [ ] Validation tối thiểu trước khi bàn giao: typecheck, test, lint; format check nếu root tooling chạy được.

---

## 14. Phase 5 — Unified sync/import/export module

**Chủ đề:** đập bỏ toàn bộ sync/import/export cũ bị phân mảnh và thay bằng một module backend
riêng rẽ, dùng chung cho realtime edit, load/reconnect, delete, binding repair, import, export,
restore và replace document. Frontend chỉ giữ phần mutation capture/reconciliation cần thiết; server
là nơi quyết định final document state.

**Prerequisite:** P3A persistence/reconnect, P3B permission enforcement, P4 file lifecycle/version
history đã có surface đủ để refactor thay đường bên dưới.

**Legacy paths phải bị xóa khỏi saved-room authoritative flow:**

- [ ] Không còn `ELEMENT_UPDATE: Element[]` là write contract cho saved document.
- [ ] Không còn whole-element `version/versionNonce` làm conflict source chính.
- [ ] Không còn `applyRemoteElements(Element[])` làm final network merge cho saved document.
- [ ] Không còn import/restore/delete/persistence ghi DB trực tiếp hoặc đi đường riêng ngoài
      `SyncRoom`.
- [ ] Không còn nhiều thuật toán sync cùng tồn tại cho cùng một saved-room mutation path.

### [P5-01] Module boundary & legacy removal — [BE]

- [BE] Tạo module sync riêng, ví dụ `backend/src/sync/`, chứa contracts, `SyncRoom`, room actor,
  planner, repository, validators, import/replace adapters và socket/http handlers.
- [BE] Socket handlers chỉ wire auth/permission/session rồi gọi sync module; không import mutable
  singleton room state hoặc tự merge element.
- [BE] Mọi saved-room write đi qua một hàm entrypoint thống nhất, ví dụ
  `executeSyncCommand(command, actorContext)`.
- [BE] Import/restore/delete/binding repair không được gọi Prisma trực tiếp để thay document state.

**Acceptance criteria:**

- [ ] Search codebase không còn saved-room handler nào tự xử lý `ELEMENT_UPDATE` để mutate DB/store.
- [ ] Tất cả tests mutation saved-room đi qua sync module entrypoint.
- [ ] Legacy helpers chỉ còn cho local board/cross-tab hoặc migration, có comment rõ phạm vi.

### [P5-02] Shared sync contracts — `@vdt/shared`

- [ ] Định nghĩa `SyncSlot` là conflict unit nhỏ nhất, tối thiểu gồm:
  `transform.position`, `transform.size`, `transform.rotation`, `style.*`, `text.*`,
  `geometry.points`, `geometry.route`, `geometry.startPoint`, `geometry.endPoint`,
  `binding.start`, `binding.end`, `order`, `asset.src`, `embed.url`, `grouping.groupId`,
  `grouping.frameId`.
- [ ] Có exhaustive field-to-slot mapping: mọi mutable field hoặc map vào slot, hoặc ghi rõ là
  non-sync / derived / legacy-only.
- [ ] Định nghĩa `SlotPatch` chứa `elementId`, `slot`, `baseClock`, `changes`, optional
  `inverseChanges`; patch phải chứa full semantic slot value.
- [ ] Định nghĩa `SyncCommand` gồm `CreateElementCommand`, `PatchSlotsCommand`,
  `ReorderElementsCommand`, `UpdateArrowBindingCommand`, `DeleteElementsCommand`,
  `ReplaceDocumentCommand`.
- [ ] Command có `protocolVersion`, `schemaVersion`, `roomId`, `requestId`, `clientClock`,
  `baseRoomEpoch`, optional `readPreconditions`.
- [ ] Server không tin `actorId` từ payload; actor lấy từ authenticated socket/session.
- [ ] `CreateElementCommand` hỗ trợ order hints (`afterElementId`/`beforeElementId`,
  `baseOrderClock` optional) để server normalize thứ tự deterministic; create không phải patch vào
  element chưa tồn tại.
- [ ] `ReorderElementsCommand` là domain command riêng; nếu chưa implement reorder đầy đủ trong
  phase đầu thì vẫn reject `PatchSlotsCommand` vào slot `order`.

**Acceptance criteria:**

- [ ] Type tests hoặc unit tests chứng minh field-to-slot mapping không bỏ sót mutable field.
- [ ] `PatchSlotsCommand` gửi field ngoài slot, thiếu full semantic value, duplicate slot không hợp lệ,
      hoặc patch `isDeleted` đều bị reject.
- [ ] Slot `order` không được patch trực tiếp trong phase đầu; reorder phải đi domain command.
- [ ] Create element reject duplicate active id và id còn trong tombstone retention window.
- [ ] Create element materialize defaults/derived fields trước khi init slot clocks, rồi trả final
      server-normalized order trong change set.

### [P5-03] Server-authoritative `SyncRoom` + room actor — [BE]

- [BE] `SyncRoom` giữ hot state: `elements`, `documentClock`, `roomEpoch`, `slotClocks`,
  `processedRequests`.
- [BE] Mỗi room có serialized executor/room actor. Critical section gồm idempotency check,
  `planCommand`, repository commit, `applyCommitted`, enqueue ack/broadcast đúng thứ tự clock.
- [BE] Server là sequencer duy nhất. Client timestamp và `clientClock` không quyết định winner.
- [BE] Scope phase đầu cho phép một Node.js process là owner authoritative của room; nếu scale ngang
  thì cần sticky routing/room owner/ordered sequencer trước khi bật multi-instance writes.

**Acceptance criteria:**

- [ ] Hai command concurrent vào cùng room được commit theo thứ tự deterministic, không interleave
      giữa plan và apply.
- [ ] Command vào room khác không bị serialize chung nếu không cần.
- [ ] Unit test chứng minh duplicate/retry không apply lại side effect.

### [P5-04] Conflict resolution & validation — [BE]

Rule chính:

```txt
Khác slot => merge.
Cùng slot => latest-to-server wins.
Delete => delete-wins.
```

- [BE] Nếu `baseClock == currentSlotClock`: commit clean.
- [BE] Nếu `baseClock < currentSlotClock`: accept theo latest-to-server wins, ack có thể là
  `rebase` vì server truth khác optimistic base.
- [BE] Nếu `baseClock > currentSlotClock`: reject `STALE_CLIENT_STATE`, yêu cầu client fetch
  `ROOM_DIFF` hoặc `ROOM_SNAPSHOT`.
- [BE] Validation tối thiểu: `ROOM_NOT_FOUND`, `ELEMENT_NOT_FOUND`, `ELEMENT_DELETED`,
  `INVALID_SLOT`, `INVALID_FIELD`, `INVALID_VALUE`, `INVALID_SLOT_FOR_ELEMENT_TYPE`,
  `INVALID_BINDING_TARGET`, `DUPLICATE_ELEMENT_ID`, `DUPLICATE_REQUEST_CONFLICT`, `TOO_LARGE`,
  `CLOCK_OVERFLOW`, `STALE_CLIENT_STATE`, `STALE_ROOM_EPOCH`, `FORBIDDEN`,
  `UNSUPPORTED_COMMAND`, `UNSUPPORTED_PROTOCOL_VERSION`, `UNSUPPORTED_SCHEMA_VERSION`.
- [BE] Delete không được đi qua `SlotPatch`; patch vào deleted element hoặc patch `isDeleted` bị reject.
- [BE] Linear elements không nhận `transform.*` patch độc lập nếu geometry của type đó không hỗ trợ.
- [BE] Bound arrow endpoint geometry không được patch trực tiếp; dùng `UpdateArrowBindingCommand`.
- [BE] `asset.src` chỉ hợp lệ khi asset đã tồn tại và actor có quyền dùng; sync core chỉ sync
  reference, không quản lý binary upload/GC trong phase này.
- [BE] `grouping.groupId`/`grouping.frameId` không được trỏ tới missing/deleted record hoặc tạo cycle;
  khi delete group/frame, server phải clear children trong cùng change set hoặc reject theo rule
  product đã chọn.

**Acceptance criteria:**

- [ ] A move shape và B đổi fill cùng shape đồng thời: cả position và fill đều được giữ.
- [ ] A move shape và B move cùng shape đồng thời: command commit sau trên server thắng slot
      `transform.position`.
- [ ] Delete shape thắng mọi patch sau đó vào shape đã deleted.
- [ ] Viewer bị reject ở command boundary trước khi plan mutation.
- [ ] Asset/group/frame refs invalid bị reject trước khi commit; không tạo document half-valid.

### [P5-05] Change sets, ack/reject/rebase & broadcast

- [ ] `planCommand` tạo `PlannedChangeSet`; repository commit trong DB transaction stamp
  `serverClock` và trả `CommittedChangeSet`.
- [ ] `CommittedChangeSet` chứa `serverClock`, `roomEpoch`, `originActorId`, `originRequestIds`,
  `reason`, `slotPatches`, `slotClocks`, `puts`, `deletes`.
- [ ] `slotPatches` là instruction apply chính cho patch/update/repair; `puts` là materialized
  element cho create, replace, reconnect, debug và persistence, không phải lệnh replace whole
  element cho mọi mutation nhỏ.
- [ ] Sender nhận ack riêng: `commit`, `rebase`, hoặc `reject`; peers nhận broadcast
  `CommittedChangeSet`.
- [ ] Ack/broadcast cũ với `serverClock <= lastServerClock` không được overwrite state mới hơn.
- [ ] Gap `serverClock > lastServerClock + 1` phải buffer event và request `ROOM_DIFF`.

**Acceptance criteria:**

- [ ] Ack `commit/rebase` đều clear đúng pending request của sender.
- [ ] Broadcast cùng origin của chính client cũng có thể clear pending nếu ack bị miss.
- [ ] Reject không rollback mù slot đã có pending mới hơn.
- [ ] Client không replace nguyên element khi change set chỉ touch một slot.

### [P5-06] Transactional persistence & idempotency — [BE]

- [BE] Mỗi accepted command tăng `Room.documentClock` đúng một lần trong DB transaction.
- [BE] Tất cả `recordClock`, `deletedClock`, `RecordSlotClock.clock` bị touch bởi command đó bằng
  cùng `documentClock`.
- [BE] `ProcessedRequest` dùng key `{ roomId, actorId, requestId }` và `payloadHash`.
- [BE] Idempotency check chạy trước validation domain để retry create đã commit có thể replay ack,
  không bị reject nhầm `DUPLICATE_ELEMENT_ID`.
- [BE] Clock trong DB dùng `BigInt`; wire protocol dùng `number` kèm assert
  `Number.isSafeInteger`, hoặc đổi sang string nếu overflow.
- [BE] Không mutate `SyncRoom` memory trước khi DB commit; nếu DB commit thành công nhưng
  `applyCommitted` throw thì room bị mark unhealthy, reload từ Postgres và rebuild indexes trước
  khi nhận command mới.

**Acceptance criteria:**

- [ ] Retry cùng `requestId` + cùng payload replay ack cũ, không tăng clock.
- [ ] Retry cùng `requestId` + payload khác bị reject `DUPLICATE_REQUEST_CONFLICT`.
- [ ] Crash/restart sau commit DB nhưng trước ack vẫn replay được ack từ `ProcessedRequest`.
- [ ] Một command delete 3 shape và repair 5 arrow chỉ tăng clock một lần.
- [ ] Server chỉ ACK sau khi DB transaction commit; DB fail không đổi memory và không gửi ACK.

### [P5-07] Load, reconnect & diff

- [ ] `ROOM_SNAPSHOT` hydrate full server state, `documentClock`, `roomEpoch`, slot clocks.
- [ ] `ROOM_DIFF` từ `lastServerClock` trả changed records, deleted tombstones, slot clocks và
  server clock; nếu tombstone history quá cũ thì trả `wipe_all` snapshot.
- [ ] `ROOM_DIFF`/`ROOM_SNAPSHOT` phải đọc state nhất quán tại một target clock (DB transaction
  consistent snapshot hoặc serialize qua room actor nếu đọc từ hot `SyncRoom`).
- [ ] Client giữ `lastServerClock` là clock mới nhất đã apply đầy đủ vào `serverState`.
- [ ] Client giữ `knownSlotClock[elementId][slot]`; không lấy max slot clock lẻ rồi coi là đã
  apply full document clock.
- [ ] Reconnect gửi `lastServerClock`, `roomEpoch` và pending request ids; server replay pending
  statuses/acks qua `ProcessedRequest`.
- [ ] Không trả `ROOM_DIFF` xuyên qua replace boundary: nếu `lastServerClock < roomEpoch`, server
  trả full `ROOM_SNAPSHOT wipe_all` tại current `roomEpoch/serverClock`.
- [ ] Nếu diff quá lớn thì trả snapshot nếu còn trong limit; nếu response có `hasMore`, client tiếp
  tục request theo `nextFromClock` cho tới target server clock.

**Acceptance criteria:**

- [ ] Client mất mạng, peer edit/delete nhiều object, reconnect chỉ fetch diff nếu còn history.
- [ ] Diff apply slot-aware: chỉ slot có clock mới hơn base mới được copy từ materialized element.
- [ ] Pending create/patch/delete replay đúng dependency order sau reconnect.
- [ ] Nếu diff có gap hoặc quá cũ, client wipe optimistic state cũ và hydrate snapshot an toàn.
- [ ] Pending quá idempotency retention nhận status `expired`/manual retry thay vì resend mù.

### [P5-08] Delete, tombstone & binding repair — [BE]

- [BE] `DeleteElementsCommand` xóa records sống, ghi tombstones và emit deletes trong
  `CommittedChangeSet`.
- [BE] Delete shape phải repair arrows/bindings liên quan bằng slot patches đầy đủ
  (`binding.start`, `binding.end`, `geometry.route`, `geometry.startPoint`,
  `geometry.endPoint` khi cần).
- [BE] Binding update là domain command riêng, có validation target và server recompute geometry khi
  read preconditions stale theo rule đã chọn.
- [BE] Khi transform/geometry của shape đang là binding target đổi, server phải recompute endpoint/path
  của arrows liên quan trong cùng `PlannedChangeSet`; không commit target change rồi để arrow lệch
  visual.
- [BE] Có giới hạn như `MAX_ELEMENTS_PER_DELETE`, `MAX_REPAIRED_ARROWS_PER_COMMAND`,
  `MAX_CHANGESET_BYTES`.

**Acceptance criteria:**

- [ ] Delete bound shape không để arrow trỏ tới id chết.
- [ ] Peer nhận cùng change set có state arrow/binding giống sender.
- [ ] Delete/import/replace không resurrect element đã tombstone ngoài ý muốn.
- [ ] Command vượt limit bị reject `TOO_LARGE` và không commit partial.
- [ ] Move/resize/rotate bound target cập nhật repaired arrow geometry trong cùng server clock.

### [P5-09] Replace document for import/restore — [BE]

- [BE] `ReplaceDocumentCommand` là đường duy nhất để thay toàn bộ saved document khi native import,
  restore snapshot hoặc convert local board sang saved document cần replace.
- [BE] Replace document tăng `roomEpoch` để pending command cũ bị reject `STALE_ROOM_EPOCH`.
- [BE] Trước import/restore phải tạo safety snapshot nếu feature snapshot đã bật.
- [BE] Replace document transaction xóa/ghi records, tombstones, slot clocks, document metadata liên
  quan và stamp một `CommittedChangeSet` reason `replace_document`.
- [BE] Replace document phải rebuild slot clocks từ scratch cho toàn bộ incoming elements; không giữ
  stale slot clock của element cùng id nhưng đổi type/schema.
- [BE] Broadcast `ROOM_REPLACED`/replace change set chứa `serverClock`, `roomEpoch`, elements và
  slot clocks để client wipe/re-hydrate một server truth duy nhất.
- [BE] Import adapters chỉ parse/normalize/validate/report; không mutate DB/store trực tiếp.

**Acceptance criteria:**

- [ ] Native `.vdt.json` import vào saved document đi qua `ReplaceDocumentCommand` hoặc domain
      command tương ứng, không bypass repository.
- [ ] Snapshot restore đi qua cùng path với import/replace và broadcast một server truth duy nhất.
- [ ] Pending command trước replace bị cancel/reject, không ghost push sau restore/import.
- [ ] Viewer/editor không đủ quyền bị reject trước khi parse/apply payload lớn.
- [ ] Element cùng id sau replace nhưng đổi type/schema không giữ lại slot clock cũ.

### [P5-10] Export adapters use materialized server truth

- [ ] Native export lấy snapshot materialized từ `SyncRoom`/repository, không đọc state client cũ khi
  export saved document.
- [ ] Cross-platform export/import adapters dùng chung normalizer/validator với sync module để field
  mapping không lệch.
- [ ] Export không mutate document, không tăng `documentClock`.
- [ ] Import report gồm số object import được, skipped và lý do chính.

**Acceptance criteria:**

- [ ] Export ngay sau concurrent edits phản ánh server state mới nhất đã commit.
- [ ] Import/export round-trip `.vdt.json` giữ element types, styles, zIndex/order, angle,
      group/frame metadata và asset references hiện có.
- [ ] Unsupported object bị skip/report, không tạo document half-mutated.

### [P5-11] Frontend reconciliation

- [ ] Client tách `serverState` và `optimisticState`.
- [ ] Local mutation tạo command từ before/after, group changed fields theo `SyncSlot`.
- [ ] Coalesce drag patch theo `{ elementId, slot }` trong flush window; inverse lấy từ before đầu,
  changes lấy từ after cuối.
- [ ] Pending queue keyed by `requestId`, có dependency order cho pending create -> patch/delete.
- [ ] Mutation vào element chưa ACK create phải squash vào create nếu chưa gửi, hoặc giữ dependency
  order nếu create đã gửi; delete trước khi create được gửi thì cancel create local.
- [ ] Sau ack/broadcast, client apply slot-aware vào `serverState`, update known clocks, remove
  pending đã origin từ mình, rồi replay pending lên `optimisticState`.
- [ ] Sau `ROOM_REPLACED`/replace-document, pending cũ bị clear/cancel.
- [ ] Presence/cursor/selection không đi qua `SlotPatch`, không persist và không tăng
  `documentClock`.

**Acceptance criteria:**

- [ ] Drag liên tục không tạo queue vô hạn; final pointerup patch luôn được gửi.
- [ ] A kéo shape trong lúc B đổi màu: A vẫn thấy màu của B sau reconciliation, không mất local drag
      cuối đã accepted.
- [ ] Ack cũ đến muộn không overwrite optimistic state mới hơn.
- [ ] Reload/reconnect không double-apply command đã processed.
- [ ] Multiplayer-aware undo đầy đủ không nằm trong phase này; undo phase đầu chỉ gửi inverse
      single-slot patch nếu slot clock chưa đổi từ edit gốc.

### [P5-12] Scope guardrails / non-goals

- [ ] Postgres vẫn là durable source of truth cho sync core; Redis chỉ là optional scale/cache layer,
  không thay Postgres làm source of truth.
- [ ] Không thêm MongoDB hoặc database thứ hai cho sync core trong phase này.
- [ ] Không bắt buộc thêm WAL/`SyncOperation` riêng; version history/audit/replay bằng operation log
  là hướng future nếu cần.
- [ ] Không làm multi-master CRDT, character-level collaborative text hoặc per-point merge cho
  freehand/highlighter.
- [ ] Không làm merge import file trong phase đầu; import/restore saved document dùng replace path.
- [ ] Không làm asset binary upload/storage/ref-count/GC trong sync core Phase 5.

### Phase 5 Definition of Done

- [ ] Saved-room realtime edit, reconnect, delete, binding repair, native import, restore snapshot
  và export đều dùng cùng sync/import/export module.
- [ ] Không còn 4 thuật toán sync cùng tồn tại cho saved-room authoritative behavior.
- [ ] Có unit tests cho planner/validator/conflict/idempotency/repository.
- [ ] Có integration tests cho socket command -> DB transaction -> ack/broadcast -> reconnect diff.
- [ ] Có regression tests cho import/restore không bypass `SyncRoom`.
- [ ] Typecheck, lint, test và format check pass trước khi mark phase done.

---

## 15. Future backlog (không phải phase)

Các mục polish dưới đây không thuộc Phase 5 sync refactor và không được đánh số thành phase mới
trong lộ trình hiện tại:

- Element lock / unlock.
- Align / distribute + flip.
- Snap to grid, alignment guides và grid background.
- Zoom to fit / selection / reset.
- Idle/away + follow viewport.
- Sticky note + embed/iframe/video.
- Roughness rendering.
- Context menu + keyboard shortcuts mở rộng.

---

## 16. Ngoài phạm vi (Bỏ qua)

| Tính năng                       | Lý do                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Local cache offline (IndexedDB) | Đã có localStorage (P1) + DB (P3A); thừa cho quy mô đồ án.                            |
| E2E encryption                  | Xung đột với mô hình server đọc dữ liệu để lưu / phân quyền / version history.        |
| Nhúng JSON vào PNG              | Export PNG + JSON riêng đã đủ.                                                        |
| Fractional index                | Chưa cần ở quy mô vài chục–trăm object; giữ `zIndex` số nguyên, để ngỏ migration sau. |

---

## 17. Yêu cầu phi chức năng

- **Hiệu năng:** vẽ/zoom mượt ở hàng chục–trăm shape; độ trễ sync < ~200ms mạng bình thường.
- **Quy mô:** ~10–50 người/phòng đồng thời; vượt ngưỡng thì P4 admission control cho user vào sau ở `viewer`/read-only thay vì làm nghẽn mutation path.
- **Độ bền:** reload/reconnect không mất dữ liệu (P3A); state hội tụ nhất quán giữa client.
- **Khả năng mở rộng:** thêm loại shape mới chỉ qua một ShapeUtil; mọi mutation qua một pipeline.
