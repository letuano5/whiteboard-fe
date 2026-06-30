# Realtime Collaborative Tactical Whiteboard — Đặc tả yêu cầu (SRS)

|               |                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------ |
| **Phiên bản** | 0.3                                                                                        |
| **Ngày**      | 2026-06-30                                                                                 |
| **Phạm vi**   | Đồ án web collaborative whiteboard, đồng bộ realtime nhiều người trên một canvas/bản đồ số |

> **Ghi chú v0.2:** restructure lộ trình để không bị ngợp — tách Phase 1 thành P1A/P1B, tách Phase 3 thành P3A/P3B/P3C, thêm Phase 0 foundation; bổ sung **mutation pipeline** và tách **committed vs transient state**; đưa undo/redo và optimistic update lên sớm; tách `image` khỏi Canvas overlay.
>
> **Ghi chú v0.3:** bổ sung Phase 4 cho workspace/document management, sharing/public/private access, admission control, import/export, version history/rollback; đẩy các phần sync polish/advanced canvas/refactor xuống các phase sau.
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
| **[BE]** Lưu trữ (P3D+) | Redis (shared room state + Socket.IO adapter) + write-behind → PostgreSQL                                                                           |
| Conflict resolution     | Last-Write-Wins theo `version` + `versionNonce`                                                                                                      |

### 1.2 Nguyên tắc kiến trúc xuyên suốt

1. **Unified element store** — mọi đối tượng là một `Element` trong cùng store; renderer chỉ là cách hiển thị.
2. **Versioning từng element** — mỗi mutate: `version++`, random lại `versionNonce`. Nền tảng cho conflict + "chỉ gửi cái đã đổi".
3. **Shared camera transform** — mọi layer (DOM/SVG/Canvas overlay) dùng chung camera `{x, y, zoom}`.
4. **ShapeUtil (strategy)** — mỗi `type` là một module khai báo render / hit-test / resize / export riêng; core không biết chi tiết từng loại.
5. **Sync data, không sync renderer** — qua mạng (và qua tab) chỉ truyền dữ liệu `Element`.
6. **Mutation pipeline duy nhất** — mọi thay đổi element đi qua một API chung (xem §3.1), không rải rác.
7. **Tách committed vs transient state** — chỉ committed state mới được lưu/sync; tương tác tạm thời nằm riêng (xem §3.2).

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
  | 'embed'; // P5

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

  version: number;
  versionNonce: number;
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
  tombstoneHistoryStartsAtClock BigInt      @default(0)
  createdAt                     DateTime    @default(now())
  updatedAt                     DateTime    @updatedAt
  members    RoomMember[]
  records    Record[]
  tombstones Tombstone[]
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
```

> Bảng `Snapshot` (version history / checkpoint) dời sang **P4-07**.
>
> **Invariant:** `documentClock` chỉ tăng, không bao giờ giảm. Mỗi write transaction tăng clock
> một lần rồi gán `recordClock = documentClock` cho toàn bộ elements trong batch đó.

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

Trong API này tập trung xử lý: `version++`, `versionNonce = random`, `updatedAt = Date.now()`, capture history (cho undo), persist local, và broadcast nếu đang online. Nhờ vậy undo/redo và sync "miễn phí" với mọi đường mutation (tool, panel, shortcut…).

### 3.2 Apply-remote path dùng chung

Có **một** hàm áp thay đổi từ "bên ngoài" (tab khác qua `BroadcastChannel`, hoặc peer qua Socket.IO) vào store theo LWW:

```ts
applyRemoteElements(incoming: Element[])  // LWW theo version/versionNonce; bỏ qua element đang sửa cục bộ
```

→ Cross-tab sync ở **P1B** và network sync ở **P2** dùng chung hàm này. Viết một lần, tái dùng — P1B là bệ thử cho P2.

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
  3. Nếu path đơn giản vẫn lỗi, dùng **A*** trên sparse grid để tìm đường orthogonal tránh source/target bbox.
- [ ] A* chỉ được đi 4 hướng:
  - left
  - right
  - up
  - down
- [ ] Cost function của A* nên ưu tiên:
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

- [ ] Client nhận `ROOM_SNAPSHOT { elements, documentClock }` khi join; áp qua `applyRemoteElements`; lưu `lastServerClock = documentClock`.
- [ ] Phòng chưa có dữ liệu → `elements: [], documentClock: 0`.
- [BE] Server query `Record WHERE roomId = ?` và gửi snapshot kèm `documentClock` hiện tại.

### [P3A-03] Reconnect không mất data

- [ ] Socket.IO tự reconnect; client gửi `lastServerClock` khi reconnect.
- [ ] Client áp diff nhận về: upsert `changed` elements, xóa `deleted` khỏi store (`applyRemoteElements`).
- [ ] Thay đổi cục bộ chưa kịp gửi: gửi lại qua `ELEMENT_UPDATE` sau khi đã áp server diff.
- [BE] Nhận `lastServerClock` từ client, trả về:
  - Bình thường (`lastServerClock >= tombstoneHistoryStartsAtClock`): diff `{ changed: Record[], deleted: Tombstone[], documentClock }` — chỉ những gì thay đổi sau `lastServerClock`.
  - Clock quá cũ (`lastServerClock < tombstoneHistoryStartsAtClock`): wipe_all — trả full snapshot như P3A-02.

### [P3A-04] Delta push theo clock

- [BE] Sau mỗi `ELEMENT_UPDATE` nhận vào: tăng `documentClock` một lần cho cả batch, gán `recordClock = documentClock`; persist throttled vào DB.
- [ ] Client không cần track `version đã gửi` per element — clock trên server quản lý.
- [ ] `lastServerClock` client cập nhật mỗi khi nhận ack hoặc patch từ server.
- [BE] Bỏ full-resync định kỳ — clock-based diff đã đủ. Nếu phát hiện drift, thêm lại ở P5-01a.

---

## 10. Phase 3B — Auth & permission

**Chủ đề:** danh tính + phân quyền (tách khỏi persistence để giảm rủi ro). Yêu cầu: Thiết kế provider-agnostic để có thể đổi hoặc thêm auth provider khác (Supabase self-hosted, Firebase, OIDC/custom provider) mà không viết lại authorization/domain logic.

### [P3B-00] Supabase Auth integration foundation

- [ ] Chọn Supabase self-hosted làm auth provider đầu tiên, nhưng backend phải đi qua abstraction kiểu `AuthVerifier`/provider adapter; domain code không phụ thuộc trực tiếp vào Supabase SDK/API.
- [ ] Sparse-clone/copy nguyên thư mục `docker/` chính thức của Supabase để giữ đủ init files (`volumes/db/*.sql`), rồi tạo compose tối giản cho project.
- [ ] P3B mặc định giữ Supabase `db` + `auth` + `kong` để frontend dùng `@supabase/supabase-js` theo URL chuẩn (`/auth/v1`) và giảm code auth tự viết.
- [ ] Dùng `supabase/postgres:17.6.1.136` thay cho `postgres:latest`; pin image auth theo compose chính thức đang dùng.
- [ ] Được phép rebuild toàn bộ DB local/dev hiện tại từ Supabase Postgres sạch: bỏ physical data dir cũ (`.data/postgres`), tạo volume/data dir mới, rồi chạy lại Prisma migrations.
- [ ] Không modify trực tiếp bảng `auth.users`; nếu app cần thông tin user/profiles, tạo bảng app riêng trong schema `public` và sync/upsert bằng backend/Prisma sau khi verify token.
- [ ] JWT chỉ chứng minh identity; room authorization vẫn dùng dữ liệu app (`RoomMember.role`) làm nguồn sự thật.

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

### [P4-01] Workspace + document dashboard

- [ ] User có dashboard liệt kê các room/document mình sở hữu, được share, và mở gần đây.
- [ ] Tạo room mới từ dashboard; room mới mặc định `visibility = 'private'`, owner là user hiện tại.
- [ ] Đổi tên room/document; xóa hoặc archive room chỉ owner/admin được làm.
- [ ] Search/filter theo tên, owner, updatedAt, và trạng thái shared/locked.
- [BE] Thêm `Workspace` và `WorkspaceMember` nếu cần nhóm nhiều document; tối thiểu P4 có thể dùng personal workspace mặc định cho mỗi user.
- [BE] Room lưu `workspaceId`, `ownerId`, `visibility`, `locked`, `archivedAt`, `lastOpenedAt`.

### [P4-02] Sharing, public/private access, invited users

- [ ] Room hỗ trợ access mode:
  - `private`: chỉ owner và invited members được vào.
  - `link_view`: ai có link vào được với quyền viewer.
  - `link_edit`: ai có link vào được với quyền editor, trừ khi room bị locked hoặc editor slots đã đầy.
  - `public_view`: room có thể xem công khai, mutation vẫn cần role editor/owner.
- [ ] Owner có UI bật/tắt share link, copy link, đổi link mode, và revoke link.
- [ ] Owner có UI mời user theo email, đổi role `owner/editor/viewer`, remove member.
- [BE] Server quyết định `effectiveRole` khi join dựa trên `RoomMember.role`, `visibility`, lock state, và room capacity.
- [BE] Tất cả HTTP/socket mutation phải check permission server-side; UI chỉ là lớp UX.

### [P4-03] Room lock + admission control

- [ ] Owner có thể lock/unlock room; khi locked, chỉ owner/admin được mutate, editor/viewer vẫn xem realtime.
- [ ] Room có `maxParticipants` và `maxEditors` để tránh quá tải realtime.
- [ ] Nếu phòng chưa đầy: user join theo role thật hoặc role từ link.
- [ ] Nếu editor slots đã đầy: user có quyền editor vẫn được join dưới `effectiveRole = 'viewer'`.
- [ ] Khi editor rời phòng, server có thể promote user đang chờ lên editor nếu base role cho phép.
- [BE] Presence/session list phân biệt `baseRole` và `effectiveRole`.
- [BE] Server reject `ELEMENT_UPDATE`, restore, import, delete khi `effectiveRole` không đủ quyền.

### [P4-04] Native file lifecycle: save/load `.vdt.json`

- [ ] Export native `.vdt.json` gồm schema version, room metadata tối thiểu, camera, elements, và optional assets metadata.
- [ ] Import `.vdt.json` vào room hiện tại hoặc tạo room mới.
- [ ] Import phải validate schema version; file lạ/thiếu field cần báo lỗi rõ ràng.
- [ ] Load file không được ghi đè room đang mở nếu user chưa confirm.
- [ ] Save/load native format phải round-trip được toàn bộ element types hiện có.
- [BE] Import vào persisted room tạo batch mutation mới và tăng `documentClock`, không ghi DB bypass mutation pipeline.

### [P4-05] Cross-platform import/export

- [ ] Export PNG/SVG khớp nội dung đang thấy hoặc selection tuỳ chọn.
- [ ] Export JSON native (`.vdt.json`) là format chính để backup/migrate.
- [ ] Import Excalidraw JSON ở mức best-effort: rectangle/ellipse/line/arrow/text/image cơ bản.
- [ ] Import draw.io XML ở mức best-effort: basic shapes/connectors/text; không cam kết full fidelity.
- [ ] Unsupported styles/shapes phải degrade có kiểm soát, không crash.
- [ ] Mỗi importer trả report: số object import được, số object bị bỏ qua, lý do chính.

### [P4-06] Asset metadata + storage adapter (pre-S3)

- [ ] Image/file asset không nên chỉ nhúng base64 lâu dài; cần metadata để sau này chuyển sang object storage.
- [BE] Thêm `Asset` metadata: `id`, `roomId`, `ownerId`, `mimeType`, `size`, `storageKey`, `createdAt`.
- [BE] Storage adapter interface hỗ trợ ít nhất local/dev storage; để ngỏ S3-compatible backend (S3/R2/MinIO/Supabase Storage).
- [BE] Backend check role trước khi cấp upload/read URL hoặc nhận upload.
- [ ] Element `image.props.src` có thể trỏ tới asset URL hoặc data URL; native export cần giữ đủ thông tin để restore.

### [P4-07] Version history (snapshot) + owner restore

**Prerequisite:** P3A (PostgreSQL + Prisma schema với `Room`, `Record`, `Tombstone` đã có). P4-03 khuyến nghị (permission/lock đã rõ).

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
SNAPSHOT_LIST:    'snapshot-list'     // client request → server HTTP GET hoặc socket
SNAPSHOT_RESTORE: 'snapshot-restore'  // client → server: { roomId, snapshotId }
ROOM_RESTORED:    'room-restored'     // server → broadcast toàn phòng
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

**Server restore transaction:**

1. Check user là owner/admin của room.
2. Load snapshot theo `snapshotId`.
3. Insert snapshot hiện tại với `reason: 'restore'` (safety net).
4. Xóa toàn bộ `Record` của room, insert lại từ `snapshot.records`.
5. Xóa toàn bộ `Tombstone`, insert lại từ `snapshot.tombstones`.
6. `Room.documentClock = max(current + 1, snapshot.documentClock + 1)`.
7. Broadcast `ROOM_RESTORED` với `mode: 'wipe_all'` và toàn bộ elements.

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

---

## 14. Phase 5 — Advanced sync & polish

### [P5-01a] Optimistic ack — commit / discard

**Prerequisite:** P3A (PostgreSQL + `documentClock` đã có).

Thêm vòng ack tối giản: client biết server đã nhận và xử lý push, có thể detect timeout và retry.

**Protocol thêm vào `@vdt/shared`:**

```ts
// Mở rộng ELEMENT_UPDATE payload (client → server)
interface ElementUpdatePayload {
  roomId: string;
  requestId: string;   // uuid v4, client tự sinh
  clientClock: number; // counter tăng dần per-client
  elements: Element[];
}

// Event mới: ELEMENT_UPDATE_ACK (server → sender only, không broadcast)
type ElementUpdateAck =
  | { requestId: string; clientClock: number; serverClock: number; action: 'commit' }
  | { requestId: string; clientClock: number; serverClock: number; action: 'discard' };
```

**Server (`backend/src/index.ts`):**

- Thêm `roomClock: Map<string, number>` (in-memory, sau P3A migrate sang `documentClock` từ DB).
- Sau khi LWW upsert batch elements: tăng `roomClock` một lần, gán `serverClock = roomClock`.
- Gửi `ELEMENT_UPDATE_ACK` về **chỉ sender** (không broadcast):
  - `commit`: ít nhất một element được lưu đúng như request (version mới nhất của nó).
  - `discard`: toàn bộ elements trong batch đều bị bỏ qua vì server đang giữ version cao hơn hoặc nonce thắng.
- [BE] Tiếp tục broadcast `ELEMENT_UPDATE` cho peers như hiện tại.

**Client (`sync/pending-push.ts` — file mới, import vào `socket-client.ts`):**

```ts
interface PendingPush {
  requestId: string;
  clientClock: number;
  sentAt: number; // Date.now() — cho timeout
}
```

- `clientClock` tăng mỗi lần emit `ELEMENT_UPDATE`.
- Khi ack nhận về: xóa request khỏi `pendingPushRequests`.
- Timeout (ví dụ 10s không nhận ack): log warning, xóa khỏi queue; không cần tự retry — Socket.IO reconnect tự xử lý resend qua `ROOM_RESYNC` của P3A.
- `lastServerClock` client cập nhật từ `ack.serverClock`.

**Acceptance criteria:**

- [ ] Mỗi `ELEMENT_UPDATE` client gửi có `requestId` và `clientClock` duy nhất.
- [ ] Server gửi `ELEMENT_UPDATE_ACK` về đúng sender, không về peer khác.
- [ ] `pendingPushRequests` queue được dọn sạch sau khi nhận ack.
- [ ] `lastServerClock` client cập nhật chính xác.
- [BE] Server `roomClock` tăng monotonically, không giảm.

### [P5-01b] Optimistic rebase khi conflict

**Prerequisite:** P5-01a đã xong.

Xử lý trường hợp cạnh: hai client edit **cùng một element** đồng thời — server LWW chọn winner khác với những gì client đã gửi.

**Mở rộng protocol (bổ sung thêm vào `ELEMENT_UPDATE_ACK`):**

```ts
// Thêm action thứ ba vào union type
| { requestId: string; clientClock: number; serverClock: number; action: 'rebase'; elements: Element[] }
// elements = các element mà server đã commit với version/nonce khác request
```

**Server rule — khi nào gửi `rebase`:**

Sau khi apply LWW batch: với từng element trong request, nếu `elMap.get(el.id)` kết quả **khác** với `el` đã gửi (cùng id nhưng `versionNonce` khác — tức là một concurrent push với nonce thấp hơn đã thắng trước đó), gom các element winners đó vào `rebase.elements`.

**Client xử lý `rebase`:**

```ts
// Không cần reverse speculativeChanges — applyRemoteElements đã có LWW đúng
// Server trả về winner với cùng version nhưng nonce thấp hơn → applyRemoteElements sẽ apply
applyRemoteElements(ack.elements);
```

Lý do không cần `speculativeChanges` stack (khác tldraw): codebase này LWW trên whole-element, không phải field-level CRDT diff. `applyRemoteElements` với `(version === current.version && versionNonce < current.versionNonce)` → winner apply tự động.

**Acceptance criteria:**

- [ ] Server phát hiện và trả `rebase` khi concurrent push có nonce thấp hơn đã thắng.
- [ ] Client nhận `rebase` → `applyRemoteElements(elements)` → store hội tụ về winner.
- [ ] Test: 2 client đồng thời patch cùng element → sau ack cả hai client hiển thị cùng một state.
- [ ] Không có vòng lặp (rebase không trigger thêm push).

### [P5-02] Element lock / unlock

- [ ] `locked = true` chặn move/resize/delete đến khi unlock.

### [P5-03] Align / Distribute + Flip

- [ ] Align 6 hướng + distribute đều; flip ngang/dọc đúng cả khi đã xoay.

### [P5-04] Snap to grid + đường gióng + Grid background

- [ ] Snap làm tròn theo lưới; đường gióng khi thẳng hàng; bật/tắt grid (co theo zoom).

### [P5-05] Zoom to fit / selection / reset

- [ ] Mỗi chế độ tính `camera` đúng.

### [P5-06] Idle/Away + Follow viewport

- [ ] Không thao tác > ngưỡng → idle; ẩn tab → away.
- [ ] A follow B → camera A bám viewport B; có dừng follow; tránh vòng lặp.
- [BE] Server relay viewport cho Follow mode.

### [P5-07] Sticky note + Embed/iframe/video

- [ ] Sticky có nền màu + text.
- [ ] Embed render DOM (iframe); mặc định `pointer-events:none`, chỉ bật khi vào chế độ interact.

### [P5-08] Roughness (tuỳ chọn)

- [ ] `props.roughness` điều khiển độ "vẽ tay"; render ổn định giữa client (SVG rough mode hoặc Canvas).

### [P5-09] Context menu + Keyboard shortcuts

- [ ] Menu chuột phải theo ngữ cảnh.
- [ ] Tối thiểu: V/H/R/O/L/T, Del, Ctrl/Cmd+Z/Shift+Z, Ctrl/Cmd+C/V/D.

---

## 15. Phase 6 — Refactor: LWW → Field-level CRDT diffs (future / ngoài phạm vi đồ án)

> Phase này **không nằm trong kế hoạch triển khai** của đồ án. Ghi lại để rõ hướng phát triển nếu scale lên, và để hiểu rõ hơn trade-off của LWW hiện tại.

**Động lực:** LWW per-element có một điểm yếu rõ ràng — khi hai người edit **cùng shape nhưng khác field** đồng thời (A kéo, B đổi màu), một người mất trắng thay đổi. Với field-level diffs, cả hai thay đổi được giữ miễn là không đụng cùng field.

### [P6-01] Định nghĩa `ElementDiff` và merge strategy per field

```ts
// Đơn vị sync không còn là Element nguyên vẹn mà là diff từng field
type ScalarDiff<T> = { prev: T; next: T };  // LWW-Register per field

interface ElementDiff {
  id: string;
  // Top-level scalar fields — mỗi field là LWW-Register riêng
  x?:      ScalarDiff<number>;
  y?:      ScalarDiff<number>;
  width?:  ScalarDiff<number>;
  height?: ScalarDiff<number>;
  angle?:  ScalarDiff<number>;
  zIndex?: ScalarDiff<number>;
  locked?: ScalarDiff<boolean>;
  isDeleted?: ScalarDiff<boolean>;
  // Props — tương tự, từng field con
  props?: Partial<{
    strokeColor: ScalarDiff<string>;
    fillColor:   ScalarDiff<string>;
    strokeWidth: ScalarDiff<number>;
    opacity:     ScalarDiff<number>;
    text:        ScalarDiff<string>;       // LWW-string (char-level CRDT để sau)
    points:      ScalarDiff<[number, number][]>;  // LWW-array (replace toàn bộ)
    // ... các field còn lại
  }>;
}
```

**Merge strategy mỗi loại:**

| Field | Strategy | Ghi chú |
|---|---|---|
| `x`, `y`, `width`, `height`, `angle` | LWW-Register theo `updatedAt` + nonce | Số → không có "trung gian" hợp lý |
| `strokeColor`, `fillColor`, `opacity` | LWW-Register | Style → winner takes all per field |
| `zIndex` | LWW-Register | Fractional index sau này |
| `locked`, `isDeleted` | LWW-Register | Boolean |
| `text` | LWW-string (toàn bộ) ở P6; char-level (Yjs) nếu muốn collaborative text | Char-level cần thư viện riêng |
| `points` | LWW-array (replace toàn bộ) | Merge point-by-point không có ngữ nghĩa rõ ràng |

### [P6-02] Mutation pipeline xuất diff thay vì element

Hiện tại `MutationEvent.elements` là `Element[]` — toàn bộ snapshot sau mutation. Sau refactor:

```ts
interface MutationEvent {
  type: 'create' | 'patch' | 'delete' | 'update';
  diffs: ElementDiff[];   // chỉ những field đã thay đổi
  before: Element[];      // vẫn giữ để undo/redo
  after: Element[];       // committed state
}
```

Pipeline tính diff bằng cách so sánh `before` và `after` field-by-field trước khi fire hooks.

### [P6-03] Server apply diffs thay vì replace

```ts
// Hiện tại (LWW):
elMap.set(el.id, el);   // replace toàn bộ

// Sau refactor:
function applyDiff(existing: Element, diff: ElementDiff): Element {
  // Với mỗi field trong diff: so sánh diff.prev với existing[field]
  // Nếu existing[field] === diff.prev → apply diff.next  (fast-forward, không conflict)
  // Nếu existing[field] !== diff.prev → concurrent edit cùng field
  //   → LWW-Register: giữ giá trị có updatedAt cao hơn (hoặc nonce nhỏ hơn nếu bằng nhau)
  // Trả về element đã merge
}
```

Server không cần hiểu "ý nghĩa" của từng field — chỉ cần biết merge rule (LWW-Register per field).

Ack thay đổi: `ELEMENT_UPDATE_ACK` với `action: 'rebase'` trả về **diff thực tế đã apply** (có thể khác diff client gửi nếu có conflict per-field).

### [P6-04] `applyRemoteElements` → `applyRemoteDiffs`

```ts
// Hiện tại: nhận Element[], so sánh version/nonce toàn bộ
applyRemoteElements(incoming: Element[])

// Sau refactor: nhận ElementDiff[], merge per-field
applyRemoteDiffs(diffs: ElementDiff[])
```

Không còn skip element vì "đang kéo" — thay vào đó skip **từng field** đang active (ví dụ: đang kéo → bỏ qua `x`, `y` từ remote nhưng vẫn apply `strokeColor` nếu peer vừa đổi màu).

### [P6-05] Undo/redo với diffs

Với LWW: undo = `patchElement(id, before)` → đơn giản.

Với diffs: undo = apply inverse diff `{ prev: next, next: prev }` cho từng field. Nếu trong lúc đó peer đã thay đổi field khác → inverse diff không đụng field đó → không mất thay đổi của peer. Tốt hơn LWW nhưng cần cẩn thận với thứ tự apply.

### Tóm tắt delta so với LWW hiện tại

| Thành phần | LWW (hiện tại) | CRDT diffs (P6) |
|---|---|---|
| Đơn vị sync | `Element` (whole) | `ElementDiff` (per-field) |
| Conflict unit | Element | Field |
| Server logic | `map.set(id, el)` | `applyDiff(existing, diff)` |
| Ack rebase payload | `Element[]` | `ElementDiff[]` |
| `applyRemoteElements` | skip element nếu đang active | skip field nếu field đang active |
| Undo | restore `before` element | apply inverse diff per-field |
| Complexity | thấp | trung bình–cao |
| Khi nào upgrade | conflict per-field xảy ra thường xuyên, hoặc yêu cầu "không ai mất thay đổi" | — |

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
