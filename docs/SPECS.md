# Realtime Collaborative Tactical Whiteboard — Đặc tả yêu cầu (SRS)

|               |                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------ |
| **Phiên bản** | 0.2                                                                                        |
| **Ngày**      | 2026-06-07                                                                                 |
| **Phạm vi**   | Đồ án web collaborative whiteboard, đồng bộ realtime nhiều người trên một canvas/bản đồ số |

> **Ghi chú v0.2:** restructure lộ trình để không bị ngợp — tách Phase 1 thành P1A/P1B, tách Phase 3 thành P3A/P3B/P3C, thêm Phase 0 foundation; bổ sung **mutation pipeline** và tách **committed vs transient state**; đưa undo/redo và optimistic update lên sớm; tách `image` khỏi Canvas overlay.
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
  | 'embed'; // P4

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

```ts
Room       { id, name, ownerId, createdAt, updatedAt }
RoomMember { roomId, userId, role: 'owner' | 'editor' | 'viewer' }
Snapshot   { id, roomId, data: jsonb /* Element[] */, createdAt }
```

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

- [ ] Thao tác áp ngay cục bộ, không chờ server (cảm giác tức thì). (Ack/rebase nâng cao → P4.)

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

- [BE] Server persist state phòng vào PostgreSQL (throttle ~5–10s) và khi phòng trống.
- [BE] Schema theo §2.5: `Room`, `RoomMember`, `Snapshot`.

### [P3A-02] Load khi mở phòng

- [ ] Client nhận full snapshot từ server khi join phòng; áp vào store qua `applyRemoteElements`.
- [ ] Phòng chưa có dữ liệu → khởi tạo store rỗng.
- [BE] Server query DB và gửi snapshot khi client join.

### [P3A-03] Reconnect không mất data

- [ ] Socket.IO tự reconnect; sau reconnect áp full snapshot từ server (LWW).
- [ ] Thay đổi cục bộ chưa kịp gửi được gửi lại sau reconnect.
- [BE] Server gửi full snapshot khi client reconnect.

### [P3A-04] Chỉ gửi đã đổi + resync định kỳ

- [ ] Theo dõi `version` đã gửi từng element, chỉ gửi khi tăng.
- [ ] Nhận full-resync định kỳ từ server → `applyRemoteElements`.
- [BE] Server gửi full-resync định kỳ (~20s) làm lưới an toàn.

---

## 10. Phase 3B — Auth & permission

**Chủ đề:** danh tính + phân quyền (tách khỏi persistence để giảm rủi ro).

### [P3B-01] Auth đăng nhập

- [ ] UI login; lưu token; attach token vào socket connection.
- [BE] Luồng login (JWT); middleware verify token cho socket và HTTP.

### [P3B-02] Role owner / editor / viewer

- [ ] UI ẩn toolbar/actions khi role `viewer` (UX only — không đủ để enforce).
- [ ] Owner có UI đổi role thành viên.
- [BE] **Server từ chối mutation từ session role `viewer`** (enforce ở server, không chỉ ẩn UI).
- [BE] `RoomMember.role` lưu vai trò trong DB.

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

## 12. Phase 4 — Advanced & polish

### [P4-01] Optimistic nâng cao (ack / rebase)

- [ ] Xử lý ack từ server; rollback/rebase khi peer phản hồi khác; hội tụ theo LWW.
- [BE] Server gửi ack; resolve conflict và broadcast kết quả cuối.

### [P4-02] Version history (snapshot) + Restore

- [ ] UI liệt kê phiên bản; Restore gửi lệnh lên server và áp snapshot nhận về.
- [BE] Server lưu `Snapshot` theo timestamp; API trả danh sách + thực hiện restore.

### [P4-03] Export PNG / SVG / JSON + Import JSON

- [ ] Export PNG/SVG khớp nội dung; Export/Import JSON (`Element[]`).

### [P4-04] Lock / Unlock

- [ ] `locked = true` chặn move/resize/delete đến khi unlock.

### [P4-05] Align / Distribute + Flip

- [ ] Align 6 hướng + distribute đều; flip ngang/dọc đúng cả khi đã xoay.

### [P4-06] Snap to grid + đường gióng + Grid background

- [ ] Snap làm tròn theo lưới; đường gióng khi thẳng hàng; bật/tắt grid (co theo zoom).

### [P4-07] Zoom to fit / selection / reset

- [ ] Mỗi chế độ tính `camera` đúng.

### [P4-08] Idle/Away + Follow viewport

- [ ] Không thao tác > ngưỡng → idle; ẩn tab → away.
- [ ] A follow B → camera A bám viewport B; có dừng follow; tránh vòng lặp.
- [BE] Server relay viewport cho Follow mode.

### [P4-09] Sticky note + Embed/iframe/video

- [ ] Sticky có nền màu + text.
- [ ] Embed render DOM (iframe); mặc định `pointer-events:none`, chỉ bật khi vào chế độ interact.

### [P4-10] Roughness (tuỳ chọn)

- [ ] `props.roughness` điều khiển độ "vẽ tay"; render ổn định giữa client (SVG rough mode hoặc Canvas).

### [P4-11] Context menu + Keyboard shortcuts

- [ ] Menu chuột phải theo ngữ cảnh.
- [ ] Tối thiểu: V/H/R/O/L/T, Del, Ctrl/Cmd+Z/Shift+Z, Ctrl/Cmd+C/V/D.

---

## 13. Ngoài phạm vi (Bỏ qua)

| Tính năng                       | Lý do                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Local cache offline (IndexedDB) | Đã có localStorage (P1) + DB (P3A); thừa cho quy mô đồ án.                            |
| E2E encryption                  | Xung đột với mô hình server đọc dữ liệu để lưu / phân quyền / version history.        |
| Nhúng JSON vào PNG              | Export PNG + JSON riêng đã đủ.                                                        |
| Fractional index                | Chưa cần ở quy mô vài chục–trăm object; giữ `zIndex` số nguyên, để ngỏ migration sau. |

---

## 14. Yêu cầu phi chức năng

- **Hiệu năng:** vẽ/zoom mượt ở hàng chục–trăm shape; độ trễ sync < ~200ms mạng bình thường.
- **Quy mô:** ~10–50 người/phòng đồng thời.
- **Độ bền:** reload/reconnect không mất dữ liệu (P3A); state hội tụ nhất quán giữa client.
- **Khả năng mở rộng:** thêm loại shape mới chỉ qua một ShapeUtil; mọi mutation qua một pipeline.
