Được. Dưới đây là **full plan bản để duyệt**, theo hướng:

> **Field/group-level LWW patch merge + server-authoritative ack/rebase kiểu tldraw-lite**

Tôi sẽ viết rõ từng phần **lấy ý tưởng từ đâu**, và có vài chỗ tôi cố tình sửa nhẹ so với câu bạn chốt: thêm `baseGroupClock`, `idempotency`, `delete-wins`, `binding repair`, vì thiếu mấy cái này agent code rất dễ làm sai.

---

# Full Plan: Grouped LWW Patch Sync + tldraw-lite Ack/Rebase

## 0. Tư tưởng chính

Không sync cả `Element[]` nữa. Mỗi mutation local tạo ra patch theo **group**:

```ts id="jkscld"
transform: x, y, width, height, angle
style: strokeColor, fillColor, strokeWidth, opacity
text: text
geometry: points
binding: startBinding, endBinding
flags: locked, isDeleted
order: zIndex
```

Mỗi conflict xảy ra ở cấp:

```ts id="jos49q"
(elementId, groupKey)
```

Không phải cấp whole-element, cũng không phải property-level cực nhỏ như Figma.

**Ý tưởng lấy từ đâu:** Figma dùng mô hình object-property LWW, trong đó document có thể hình dung như `Map<ObjectID, Map<Property, Value>>`; server giữ latest value cho từng property, cùng property thì latest-to-server thắng. Ta mượn ý tưởng “không sync whole object”, nhưng gom property thành group để tránh tách rời các field liên quan như `x/y/width/height/angle`. Figma cũng thừa nhận có case nhiều property trên cùng object phải thay đổi cùng nhau nên merge phải cẩn thận, đây là lý do hợp lý để mình chọn group-level thay vì property-level thuần. ([Figma][1]) ([Figma][2])

---

## P5-00 — Chốt scope chính thức

**Mục tiêu:** đưa field/group diff vào scope chính, không để ở future phase nữa.

Bỏ các phần cũ:

```ts id="bg3bo8"
// bỏ
ELEMENT_UPDATE: Element[]
ELEMENT_UPDATE_ACK: commit | discard | rebase<Element[]>
whole-element version/versionNonce merge
```

Thay bằng:

```ts id="ez554y"
// dùng mới
GROUP_PATCH
GROUP_PATCH_ACK
ROOM_SNAPSHOT
```

**Lấy ý tưởng từ đâu:** trong chat Claude trước đó, lỗi lớn nhất được chỉ ra là plan P5 nói chọn field/group-level nhưng thực tế vẫn gửi `Element[]`, nghĩa là chưa giải quyết được bài toán “A kéo, B đổi màu thì giữ được cả hai”. Vì vậy plan mới phải kéo group-diff vào scope chính ngay. 

**Acceptance criteria:**

* Không còn gửi cả element khi user chỉ đổi một nhóm field.
* Demo được case: A kéo shape, B đổi màu shape cùng lúc → cả transform và style đều còn.

---

## P5-01 — Data model cho group metadata

Mỗi element trên server cần có state và metadata theo group:

```ts id="veqz89"
type GroupKey =
  | 'transform'
  | 'style'
  | 'text'
  | 'geometry'
  | 'binding'
  | 'flags'
  | 'order';

interface GroupMeta {
  groupClock: number;
  lastActorId: string;
  lastRequestId: string;
  lastNonce: number;
}

interface ElementState {
  id: string;
  type: string;
  fields: Record<string, unknown>;
  groups: Partial<Record<GroupKey, GroupMeta>>;
  isDeleted?: boolean;
}
```

Lý do có `groupClock`: client cần biết patch của mình được tạo dựa trên version nào của group. Nếu thiếu cái này, server rất khó phân biệt “patch mới bình thường” với “patch stale do conflict”.

**Lấy ý tưởng từ đâu:** Figma không cần timestamp vì server định nghĩa thứ tự event; với mình vẫn dùng `groupClock` không phải để thắng thua toàn cục, mà để detect stale base/rebase dễ debug hơn. ([Figma][1])

**Acceptance criteria:**

* Mỗi group của mỗi element có version riêng.
* Cập nhật `style` không làm tăng `transform.groupClock`.
* Cập nhật `transform` không đụng `style.groupClock`.

---

## P5-02 — Định nghĩa `GroupPatch`

Payload client gửi lên:

```ts id="c601rf"
interface GroupPatch {
  requestId: string;
  actorId: string;
  clientClock: number;
  nonce: number;

  elementId: string;
  group: GroupKey;

  baseGroupClock: number | null;

  changes: Record<string, unknown>;

  // Optional nhưng nên có để undo/redo local về sau
  inverseChanges?: Record<string, unknown>;
}

interface GroupPatchPayload {
  roomId: string;
  batchId: string;
  patches: GroupPatch[];
}
```

Ví dụ user đổi màu:

```ts id="h9imky"
{
  elementId: "shape-1",
  group: "style",
  baseGroupClock: 7,
  changes: {
    fillColor: "#ff0000",
    strokeColor: "#222222"
  }
}
```

Ví dụ user kéo shape:

```ts id="wud6v5"
{
  elementId: "shape-1",
  group: "transform",
  baseGroupClock: 12,
  changes: {
    x: 120,
    y: 240
  }
}
```

**Lấy ý tưởng từ đâu:** tldraw sync gửi local changes lên server dưới dạng diff operations, server validate rồi broadcast/rebase khi cần; mình làm bản nhỏ hơn, diff chỉ là `GroupPatch`. ([tldraw][3])

**Acceptance criteria:**

* Một mutation có thể sinh nhiều patch nếu chạm nhiều group.
* Không gửi field không đổi.
* `requestId` duy nhất cho từng patch, không phải cho cả batch.

---

## P5-03 — Mapping field → group

Hardcode rõ ràng ngay từ đầu:

```ts id="bxuvm9"
const FIELD_TO_GROUP = {
  x: 'transform',
  y: 'transform',
  width: 'transform',
  height: 'transform',
  angle: 'transform',

  strokeColor: 'style',
  fillColor: 'style',
  strokeWidth: 'style',
  opacity: 'style',

  text: 'text',

  points: 'geometry',

  startBinding: 'binding',
  endBinding: 'binding',

  locked: 'flags',
  isDeleted: 'flags',

  zIndex: 'order',
} as const;
```

Tôi thêm `order: zIndex`, vì layer order không nên nhét vào `style` hay `transform`.

**Lấy ý tưởng từ đâu:** Figma có fractional indexing để giải quyết thứ tự trong tree/layer order; mình chưa cần làm đầy đủ như Figma, nhưng nên tách `order` thành group riêng để sau này nâng cấp dễ. ([Figma][1])

**Acceptance criteria:**

* `zIndex` không nằm chung với style/transform.
* `isDeleted` nằm trong flags nhưng có rule đặc biệt ở server.
* Không có field nào không map được group.

---

## P5-04 — Client mutation pipeline: before/after → group patches

Khi local mutation xảy ra:

1. Chụp `before`.
2. Apply local state ngay để UI responsive.
3. Chụp `after`.
4. Diff `before/after`.
5. Gom field thay đổi theo group.
6. Tạo `GroupPatch[]`.
7. Đưa vào pending queue.
8. Flush qua socket.

Pseudo:

```ts id="zqlmac"
function onLocalMutation(before: Element[], after: Element[]) {
  const changedFields = diffElements(before, after);

  const grouped = groupBy(changedFields, field => FIELD_TO_GROUP[field.key]);

  for (const [group, fields] of grouped) {
    const patch: GroupPatch = {
      requestId: uuidv4(),
      actorId,
      clientClock: nextClientClock(),
      nonce: randomNonce(),

      elementId: fields.elementId,
      group,

      baseGroupClock: getKnownGroupClock(fields.elementId, group),

      changes: pickNextValues(fields),
      inverseChanges: pickPrevValues(fields),
    };

    pending.add(patch);
    batchQueue.add(patch);
  }

  scheduleFlush();
}
```

**Lấy ý tưởng từ đâu:** tldraw apply local changes ngay để UI responsive, rồi reconcile async với server; Figma cũng apply local property changes ngay thay vì chờ server ack để tránh UI chậm. ([tldraw][3]) ([Figma][1])

**Acceptance criteria:**

* Kéo shape không gửi nguyên element.
* Đổi màu không gửi transform.
* Một thao tác resize đổi `x/y/width/height` sinh một patch `transform`, không sinh 4 patch riêng.

---

## P5-05 — Flush policy

Khi user thao tác liên tục như kéo/vẽ, không emit từng event nhỏ ngay lập tức. Coalesce theo slot:

```ts id="kxcp17"
slot = `${elementId}:${group}`
```

Trong một frame flush, chỉ gửi patch cuối cùng của mỗi slot.

```ts id="6f1fko"
const FLUSH_MS = 33; // khoảng 30 FPS
```

**Lấy ý tưởng từ đâu:** tldraw docs ghi sync ở 30 FPS khi collaborating và giảm xuống 1 FPS khi solo để tiết kiệm bandwidth; mình lấy 30 FPS làm baseline đơn giản. ([tldraw][3])

**Acceptance criteria:**

* Drag 1 giây không spam hàng trăm socket messages.
* Nếu trong 33ms có 5 update transform cùng element, chỉ gửi latest transform.
* Style/text update vẫn gửi bình thường.

---

## P5-06 — Server authoritative room

Server giữ state authoritative:

```ts id="hxzf25"
class SyncRoom {
  roomId: string;
  serverClock = 0;

  elements = new Map<string, ElementState>();

  // idempotency
  processedRequests = new Map<string, ProcessedResult>();
}
```

Giả định quan trọng:

```md id="tdt1kn"
Trong scope đồ án, một room chỉ chạy trên một Node.js process.
Server event loop xử lý socket message tuần tự.
Vì vậy server là nguồn định thứ tự cuối cùng.
```

**Lấy ý tưởng từ đâu:** tldraw dùng server làm authoritative source; bản Cloudflare của tldraw dùng Durable Object, mỗi room có một instance authoritative riêng, user connect vào đúng instance đó. ([tldraw][3]) ([GitHub][4])

**Acceptance criteria:**

* Mọi merge xảy ra ở server, client không tự quyết final state.
* `serverClock` tăng monotonically.
* Nếu sau này scale nhiều process, phải có room ownership/sticky routing; hiện tại ghi rõ là ngoài scope.

---

## P5-07 — Server apply patch

Rule chính:

```ts id="e3z0ke"
function applyPatch(patch: GroupPatch): PatchResult {
  // 0. Idempotency
  if (processedRequests.has(patch.requestId)) {
    return processedRequests.get(patch.requestId);
  }

  // 1. Validate element
  const el = elements.get(patch.elementId);
  if (!el) return discard('ELEMENT_NOT_FOUND');

  // 2. Delete-wins
  if (el.isDeleted && patch.group !== 'flags') {
    return discard('ELEMENT_DELETED');
  }

  // 3. Validate schema/value
  const validation = validateGroupPatch(patch);
  if (!validation.ok) return discard(validation.reason);

  // 4. Validate domain invariant
  if (patch.group === 'binding') {
    const ok = validateBindingTargets(patch);
    if (!ok) return discard('INVALID_BINDING_TARGET');
  }

  // 5. Detect conflict
  const currentMeta = el.groups[patch.group];
  const currentClock = currentMeta?.groupClock ?? 0;

  if (patch.baseGroupClock === currentClock) {
    return commitFastForward(patch);
  }

  return resolveGroupConflict(patch, currentClock);
}
```

**Lấy ý tưởng từ đâu:** Figma server reject những update làm hỏng cấu trúc tree, ví dụ parent cycle; vì vậy mình cũng cần server-side guard cho binding/delete, không để client tự sửa best-effort. ([Figma][1])

**Acceptance criteria:**

* Patch invalid phải có kết quả tường minh, không im lặng drop.
* Binding tới element đã delete bị reject.
* Patch tới element đã delete bị discard/reject, không làm sống lại element.

---

## P5-08 — Conflict resolution trong cùng group

Tôi đề xuất rule đơn giản nhất:

```md id="jnw9w2"
Nếu baseGroupClock == currentGroupClock:
  commit.

Nếu baseGroupClock < currentGroupClock:
  conflict cùng group.
  Vì server là authoritative sequencer, patch đến sau có thể thắng theo LWW.
  Server apply patch mới, tăng groupClock, rồi trả rebase cho client nếu cần.
```

Tức là **latest-to-server wins trong cùng group**.

Không nên dùng `clientClock` để quyết winner giữa các client, vì clock mỗi client không so sánh toàn cục được. `clientClock` chỉ để debug/order local pending. `actorId + nonce` chỉ dùng tie-break nếu cần deterministic trong test hoặc khi batch cùng server tick, nhưng bình thường server receive order là đủ.

```ts id="alfjy9"
function resolveGroupConflict(patch: GroupPatch): PatchResult {
  // LWW theo thứ tự server nhận
  const actualPatch = applyPatchToState(patch);
  return {
    action: 'rebase',
    requestId: patch.requestId,
    serverClock,
    actualPatch,
  };
}
```

**Lấy ý tưởng từ đâu:** Figma nói không cần timestamp vì server có thể định nghĩa thứ tự event; cùng property thì last value sent to server wins. Ta áp dụng cùng tư tưởng nhưng ở cấp group. ([Figma][1])

**Acceptance criteria:**

* Hai client cùng sửa `style` một shape → state cuối là patch đến server sau.
* Hai client sửa `style` và `transform` cùng shape → merge cả hai, không conflict.
* Không dùng `Date.now()` client để quyết thắng thua.

---

## P5-09 — Ack protocol: commit / discard / rebase

Server trả ack riêng cho sender:

```ts id="a9kc45"
type GroupPatchAck =
  | {
      action: 'commit';
      requestId: string;
      serverClock: number;
      elementId: string;
      group: GroupKey;
      groupClock: number;
    }
  | {
      action: 'discard';
      requestId: string;
      serverClock: number;
      elementId: string;
      group: GroupKey;
      reason: DiscardReason;
      serverPatch?: GroupPatch;
    }
  | {
      action: 'rebase';
      requestId: string;
      serverClock: number;
      elementId: string;
      group: GroupKey;
      actualPatch: GroupPatch;
    };
```

Broadcast cho peers:

```ts id="b1jsi9"
interface GroupPatchBroadcast {
  roomId: string;
  serverClock: number;
  patches: ServerGroupPatch[];
}
```

Tôi vẫn giữ `ack` riêng thay vì Figma-style “broadcast quay lại là ack”, vì bạn đang chọn tldraw-lite. Ack riêng dễ debug, dễ test, hợp với đồ án.

**Lấy ý tưởng từ đâu:** tldraw protocol có `push_result` gồm acknowledgment của client push: `commit`, `discard`, hoặc `rebase`. ([tldraw][3])

**Acceptance criteria:**

* Sender luôn nhận ack cho từng requestId.
* Peer chỉ nhận broadcast patch đã được server commit.
* Rebase không trigger local mutation mới.

---

## P5-10 — Client pending queue + rebase

Client giữ pending theo request:

```ts id="p12ehy"
interface PendingPatch {
  requestId: string;
  patch: GroupPatch;
  sentAt: number;
  status: 'queued' | 'sent';
}

const pendingByRequestId = new Map<string, PendingPatch>();
```

Khi nhận ack:

```ts id="emxhem"
function onAck(ack: GroupPatchAck) {
  const pending = pendingByRequestId.get(ack.requestId);
  if (!pending) return;

  if (ack.action === 'commit') {
    pendingByRequestId.delete(ack.requestId);
    updateKnownGroupClock(ack.elementId, ack.group, ack.groupClock);
    return;
  }

  if (ack.action === 'discard') {
    rollbackOrResync(pending.patch, ack.serverPatch);
    pendingByRequestId.delete(ack.requestId);
    return;
  }

  if (ack.action === 'rebase') {
    applyRemotePatch(ack.actualPatch, { silent: true });
    pendingByRequestId.delete(ack.requestId);
    updateKnownGroupClockFromPatch(ack.actualPatch);
    return;
  }
}
```

Nếu đang có local pending mới hơn cùng `(elementId, group)`, không rollback bừa. Cần recompute từ server snapshot + pending còn lại, hoặc ít nhất check request có bị superseded chưa.

**Lấy ý tưởng từ đâu:** tldraw khi conflict thì client undo local changes, apply server changes rồi replay local changes; mình làm bản nhẹ hơn: apply `actualPatch` và không trigger push lại. ([tldraw][3])

**Acceptance criteria:**

* Ack cũ đến muộn không ghi đè pending mới hơn.
* Rebase không tạo vòng lặp emit lại.
* Pending queue dọn sạch sau commit/discard/rebase.

---

## P5-11 — Idempotency bắt buộc

Server phải nhớ `requestId` đã xử lý:

```ts id="qro5mi"
type ProcessedResult =
  | { kind: 'commit'; ack: GroupPatchAck; broadcastPatch: ServerGroupPatch }
  | { kind: 'discard'; ack: GroupPatchAck }
  | { kind: 'rebase'; ack: GroupPatchAck; broadcastPatch: ServerGroupPatch };
```

Nếu client resend cùng `requestId` sau reconnect:

* Không apply lại.
* Gửi lại ack cho sender.
* Không broadcast duplicate nếu patch đã broadcast rồi.

**Lý do:** nếu không có idempotency, reconnect có thể replay request cũ và rollback state mới hơn.

**Lấy ý tưởng từ đâu:** đây là phần hardening thực tế cho ack/retry. tldraw có push/result protocol rõ ràng, còn bản của mình phải tự đảm bảo request retry không mutate state lần hai. ([tldraw][3])

**Acceptance criteria:**

* Gửi lại cùng requestId 2 lần → state chỉ đổi 1 lần.
* Reconnect resend không rollback thay đổi mới hơn của peer.
* Test duplicate request pass.

---

## P5-12 — Create/Delete là op riêng

Không tạo element bằng group patch thường.

```ts id="lkft2r"
interface CreateElementPayload {
  roomId: string;
  requestId: string;
  actorId: string;
  element: Element;
}

interface DeleteElementPayload {
  roomId: string;
  requestId: string;
  actorId: string;
  elementId: string;
}
```

Delete rule:

```md id="bc92o5"
Delete-wins.
Khi element đã deleted, mọi patch khác bị discard, trừ restore/undo tường minh.
```

Khi delete shape, server cần repair binding:

```ts id="k46oth"
for each arrow:
  if arrow.startBinding.elementId === deletedId:
    clear startBinding
  if arrow.endBinding.elementId === deletedId:
    clear endBinding
```

**Lấy ý tưởng từ đâu:** Figma nói create/remove là explicit actions, object không tự xuất hiện bằng cách write property vào unassigned ID; remove object cũng xoá data server-side. Mình mượn rule explicit create/delete để tránh element “ma”. ([Figma][1])

**Acceptance criteria:**

* Create trùng ID không tạo element thứ hai.
* Delete không làm element sống lại vì patch transform đến muộn.
* Arrow không giữ binding tới shape đã delete.

---

## P5-13 — Schema validation

Mỗi group phải validate field được phép và type hợp lệ.

```ts id="tcbcw0"
const GROUP_FIELDS = {
  transform: ['x', 'y', 'width', 'height', 'angle'],
  style: ['strokeColor', 'fillColor', 'strokeWidth', 'opacity'],
  text: ['text'],
  geometry: ['points'],
  binding: ['startBinding', 'endBinding'],
  flags: ['locked', 'isDeleted'],
  order: ['zIndex'],
};
```

Reject reason:

```ts id="k9wkwm"
type DiscardReason =
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_DELETED'
  | 'INVALID_GROUP'
  | 'INVALID_FIELD'
  | 'INVALID_VALUE'
  | 'INVALID_BINDING_TARGET'
  | 'DUPLICATE_REQUEST'
  | 'DUPLICATE_ELEMENT_ID';
```

**Lấy ý tưởng từ đâu:** tldraw server có validation/schema migration trong sync system; mình không cần làm migration đầy đủ, nhưng validate payload là bắt buộc. ([tldraw][3])

**Acceptance criteria:**

* Client không thể gửi `style` patch chứa `x`.
* `width = "abc"` bị reject.
* Unknown field bị reject.

---

## P5-14 — Room snapshot / reconnect

Khi join room:

```ts id="aah35z"
interface RoomSnapshot {
  roomId: string;
  serverClock: number;
  elements: Element[];
  groupClocks: Record<string, Partial<Record<GroupKey, number>>>;
}
```

Reconnect flow:

1. Client nhận snapshot.
2. Hydrate store bằng snapshot.
3. Cập nhật known group clocks.
4. Replay pending local patches chưa ack lên UI.
5. Resend pending patches với cùng `requestId`.

```ts id="auit7g"
function onReconnect(snapshot: RoomSnapshot) {
  store.hydrate(snapshot.elements);
  updateKnownGroupClocks(snapshot.groupClocks);

  for (const pending of pendingByRequestId.values()) {
    applyLocalPatch(pending.patch, { silent: true });
    queueForResend(pending.patch);
  }

  flush();
}
```

**Lấy ý tưởng từ đâu:** tldraw có connection states và initial sync/patch flow; Figma-style optimistic systems cũng cần giữ local unacknowledged changes để tránh flicker. ([tldraw][3]) ([Figma][1])

**Acceptance criteria:**

* Reconnect không làm shape nhảy ngược lâu.
* Pending được resend cùng requestId.
* Server idempotency xử lý duplicate an toàn.

---

## P5-15 — Persistence/checkpoint

Scope đồ án nên làm đơn giản:

* In-memory room là source of truth khi room active.
* PostgreSQL lưu snapshot định kỳ.
* Checkpoint mỗi N patches hoặc mỗi 15s.

```ts id="pbefsv"
interface RoomCheckpoint {
  roomId: string;
  serverClock: number;
  snapshotJson: object;
  updatedAt: Date;
}
```

Không làm WAL từng patch trong phase này.

**Lấy ý tưởng từ đâu:** tldraw sync cho phép storage layer in-memory, SQLite hoặc custom; bản Cloudflare Durable Object persist state bằng SQLite built-in. Mình chọn snapshot PostgreSQL vì đủ cho đồ án, dễ implement hơn WAL. ([tldraw][3]) ([GitHub][4])

**Acceptance criteria:**

* Server restart load được snapshot gần nhất.
* Chấp nhận mất tối đa thay đổi sau checkpoint cuối.
* Ghi rõ hạn chế này trong báo cáo.

---

## P5-16 — Undo/redo

Không làm multiplayer-aware undo như Figma production. Chỉ làm local-user undo.

Undo = gửi inverse patch qua pipeline bình thường:

```ts id="wabp50"
function undo() {
  const inverse = undoStack.pop();
  sendGroupPatch(inverse);
}
```

Rule:

* Undo chỉ undo thao tác của chính user.
* Nếu người khác sửa cùng group sau đó, undo của mình có thể overwrite theo LWW.
* Ghi rõ là limitation.

**Lấy ý tưởng từ đâu:** Figma blog nói undo trong multiplayer rất khó vì redo/undo có thể vô tình overwrite người khác; vì đồ án, mình chọn bản đơn giản và ghi rõ giới hạn. ([Figma][2])

**Acceptance criteria:**

* Undo đổi màu không restore cả element.
* Undo transform không mất style peer vừa đổi.
* Nếu cùng group conflict thì theo LWW server order.

---

## P5-17 — Presence giữ riêng

Presence/cursor/selection không đi qua group patch.

```ts id="zmosdz"
PRESENCE_UPDATE {
  roomId,
  actorId,
  cursor,
  selectedIds,
  viewport
}
```

Không persist vào snapshot document.

**Lấy ý tưởng từ đâu:** tldraw docs tách presence awareness khỏi document synchronization. ([tldraw][3])

**Acceptance criteria:**

* Cursor/selection realtime.
* Refresh page không lưu presence cũ.
* Presence không tăng document `serverClock`.

---

## P5-18 — Test plan bắt buộc

Các test nên có trước khi bảo vệ:

| Case                                             | Expected                                               |
| ------------------------------------------------ | ------------------------------------------------------ |
| A kéo shape, B đổi màu cùng lúc                  | merge cả `transform` và `style`                        |
| A đổi fillColor, B đổi strokeColor cùng lúc      | vì cùng `style`, latest-to-server thắng cả style group |
| A kéo, B resize cùng shape                       | cùng `transform`, latest-to-server thắng               |
| A sửa text, B đổi màu                            | merge `text` + `style`                                 |
| A delete shape, B kéo shape đó                   | delete-wins, transform bị discard                      |
| A delete shape target, B bind arrow vào shape đó | binding bị discard/reject                              |
| Client mất kết nối sau khi gửi patch             | reconnect resend cùng requestId, không apply duplicate |
| Server restart                                   | load snapshot gần nhất                                 |
| Duplicate requestId                              | state chỉ đổi một lần                                  |
| Ack/rebase đến muộn                              | không overwrite pending mới hơn                        |

---

# Kết luận để bạn duyệt

Tôi sẽ chốt plan này, với 3 chỉnh sửa quan trọng so với câu bạn đưa:

1. **Bắt buộc có `baseGroupClock`** để detect conflict/rebase rõ ràng.
2. **Bắt buộc có idempotency theo `requestId`** để reconnect/retry không mutate state lần hai.
3. **Create/delete/binding là domain rule riêng**, không phó mặc cho LWW.

Tên hướng nên ghi trong specs/báo cáo:

> **Grouped-property LWW synchronization with server-authoritative tldraw-lite ack/rebase**

Nó lấy lõi từ:

* **Figma**: không sync whole object, LWW theo đơn vị nhỏ hơn object, server định nghĩa order.
* **tldraw**: server authoritative, optimistic update, push result `commit/discard/rebase`.
* **Excalidraw**: chỉ dùng làm đối chứng để giải thích vì sao không chọn whole-element LWW thô.
* **Thiết kế riêng của mình**: gom field thành group để cân bằng giữa concurrency và consistency hình học.

[1]: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/ "How Figma’s multiplayer technology works | Figma Blog"
[2]: https://www.figma.com/blog/multiplayer-editing-in-figma/ "Multiplayer Editing in Figma | Figma Blog"
[3]: https://tldraw-tldraw.mintlify.app/sync/introduction "Multiplayer overview - tldraw"
[4]: https://github.com/tldraw/tldraw-sync-cloudflare "GitHub - tldraw/tldraw-sync-cloudflare: Bring multiplayer mode to your tldraw canvas app. Self-hosted and powered by tldraw sync and Cloudflare Durable Objects. · GitHub"


# Các phần cập nhật cho plan sync

## Sửa P5-01 — Slot metadata thay cho `groupClock`

**Thay đổi:** bỏ tên `groupClock`. Dùng khái niệm `slot.clock`.

Một **slot** là đơn vị conflict nhỏ nhất trong hệ thống. Slot có thể là một group nhiều field, hoặc một field độc lập.

```ts
type SyncSlot =
  | 'transform'
  | 'style.fillColor'
  | 'style.strokeColor'
  | 'style.strokeWidth'
  | 'style.opacity'
  | 'text'
  | 'geometry'
  | 'binding.start'
  | 'binding.end'
  | 'flags.locked'
  | 'flags.deleted'
  | 'order';
```

Server lưu metadata theo slot:

```ts
interface SlotMeta {
  clock: number; // bằng serverClock tại lần cuối slot này được sửa
  lastActorId?: string;
  lastRequestId?: string;
}

interface ElementSyncMeta {
  slots: Partial<Record<SyncSlot, SlotMeta>>;
}
```

Giải thích:

* `serverClock`: clock toàn room/document, tăng sau mỗi patch được commit.
* `slot.clock`: giá trị `serverClock` tại lần cuối slot đó thay đổi.
* Client không gửi `slot.clock` hiện tại. Client chỉ gửi `baseClock`, tức version slot mà nó đã thấy khi tạo patch.

---

## Sửa P5-02 — Patch dùng `baseClock`, không dùng `baseGroupClock`

**Thay thế `GroupPatch` cũ bằng `SlotPatch`:**

```ts
interface SlotPatch {
  requestId: string;
  actorId: string;
  clientClock: number;

  elementId: string;
  slot: SyncSlot;

  // Clock của slot tại thời điểm client tạo patch
  baseClock: number | null;

  // Chỉ chứa field thuộc slot này
  changes: Record<string, unknown>;

  // Dùng cho undo có điều kiện
  inverseChanges?: Record<string, unknown>;
}

interface SlotPatchPayload {
  roomId: string;
  batchId: string;
  patches: SlotPatch[];
}
```

Ví dụ kéo shape:

```ts
{
  requestId: "req-1",
  actorId: "user-a",
  clientClock: 18,
  elementId: "shape-1",
  slot: "transform",
  baseClock: 42,
  changes: {
    x: 120,
    y: 240
  },
  inverseChanges: {
    x: 80,
    y: 200
  }
}
```

Ví dụ đổi màu fill:

```ts
{
  requestId: "req-2",
  actorId: "user-b",
  clientClock: 9,
  elementId: "shape-1",
  slot: "style.fillColor",
  baseClock: 45,
  changes: {
    fillColor: "#ff0000"
  },
  inverseChanges: {
    fillColor: "#ffffff"
  }
}
```

---

## Sửa P5-03 — Mapping field sang slot

**Thay group `style` bằng các slot style riêng.**

```ts
const FIELD_TO_SLOT = {
  x: 'transform',
  y: 'transform',
  width: 'transform',
  height: 'transform',
  angle: 'transform',

  fillColor: 'style.fillColor',
  strokeColor: 'style.strokeColor',
  strokeWidth: 'style.strokeWidth',
  opacity: 'style.opacity',

  text: 'text',

  points: 'geometry',

  startBinding: 'binding.start',
  endBinding: 'binding.end',

  locked: 'flags.locked',
  isDeleted: 'flags.deleted',

  zIndex: 'order',
} as const;
```

Lý do:

* `transform` vẫn gom `x/y/width/height/angle` vì các field này liên quan hình học.
* Style tách riêng vì `fillColor`, `strokeColor`, `strokeWidth`, `opacity` không phụ thuộc nhau.
* `binding.start` và `binding.end` tách riêng để A sửa đầu mũi tên, B sửa đuôi mũi tên vẫn merge được.
* `flags.deleted` là slot đặc biệt, có rule delete-wins.
* `order` chỉ dùng cho `zIndex`.

---

## Sửa P5-05 — Flush/coalesce theo slot

Client coalesce patch theo:

```ts
const patchSlotKey = `${elementId}:${slot}`;
```

Trong một chu kỳ flush, nếu cùng một element và cùng một slot bị sửa nhiều lần, chỉ gửi patch mới nhất.

Ví dụ trong 33ms user kéo shape 5 lần:

```txt
transform x/y lần 1
transform x/y lần 2
transform x/y lần 3
transform x/y lần 4
transform x/y lần 5
```

Client chỉ gửi lần cuối.

```ts
const FLUSH_MS = 33;
```

Lưu ý: không coalesce giữa các slot khác nhau. Ví dụ `transform` và `style.fillColor` vẫn là hai patch riêng.

---

## Sửa P5-08 — Conflict resolution

**Rule chính thức:**

```txt
Khác slot => merge.
Cùng slot => latest-to-server wins.
```

Server xử lý:

```ts
function applyPatch(patch: SlotPatch): PatchResult {
  const el = elements.get(patch.elementId);
  if (!el) return reject('ELEMENT_NOT_FOUND');

  if (isDeleted(el) && patch.slot !== 'flags.deleted') {
    return reject('ELEMENT_DELETED');
  }

  const validation = validateSlotPatch(patch);
  if (!validation.ok) return reject(validation.reason);

  if (patch.slot === 'binding.start' || patch.slot === 'binding.end') {
    if (!validateBindingTarget(patch)) {
      return reject('INVALID_BINDING_TARGET');
    }
  }

  const currentClock = getSlotClock(patch.elementId, patch.slot);

  if (patch.baseClock === currentClock) {
    return commit(patch);
  }

  // Cùng slot đã bị sửa sau baseClock của client.
  // Ta chọn latest-to-server wins: patch đến server sau thắng.
  return rebaseWithLatestToServer(patch);
}
```

Trong scope hiện tại, không dùng `Date.now()` client, không dùng client timestamp để quyết winner.

Nếu có một authoritative owner cho room, thứ tự server nhận patch là thứ tự cuối cùng.

---

## Sửa P5-09 — Ack/reject protocol

Vẫn giữ ack riêng vì dễ debug và dễ test trong đồ án.

```ts
type SlotPatchAck =
  | {
      action: 'commit';
      requestId: string;
      serverClock: number;
      elementId: string;
      slot: SyncSlot;
      slotClock: number;
    }
  | {
      action: 'reject';
      requestId: string;
      serverClock: number;
      elementId: string;
      slot: SyncSlot;
      reason: RejectReason;
      serverPatch?: ServerSlotPatch;
    }
  | {
      action: 'rebase';
      requestId: string;
      serverClock: number;
      elementId: string;
      slot: SyncSlot;
      actualPatch: ServerSlotPatch;
    };
```

Reject là bắt buộc, không optional.

Reject dùng để:

* xóa pending patch khỏi client;
* rollback optimistic update nếu server không chấp nhận;
* tránh pending bị kẹt vĩnh viễn;
* tránh client bỏ qua remote update hợp lệ vì tưởng local change vẫn đang chờ ack.

Các reason tối thiểu:

```ts
type RejectReason =
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_DELETED'
  | 'INVALID_SLOT'
  | 'INVALID_FIELD'
  | 'INVALID_VALUE'
  | 'INVALID_BINDING_TARGET'
  | 'DUPLICATE_ELEMENT_ID';
```

---

## Sửa P5-10 — Client pending queue + rebase

Client giữ pending theo `requestId`, đồng thời có thể index phụ theo slot.

```ts
interface PendingPatch {
  requestId: string;
  patch: SlotPatch;
  sentAt: number;
  status: 'queued' | 'sent';
}

const pendingByRequestId = new Map<string, PendingPatch>();
const pendingBySlot = new Map<string, Set<string>>; // key = elementId:slot
```

Khi nhận ack:

```ts
function onAck(ack: SlotPatchAck) {
  const pending = pendingByRequestId.get(ack.requestId);
  if (!pending) return;

  if (ack.action === 'commit') {
    removePending(ack.requestId);
    updateKnownSlotClock(ack.elementId, ack.slot, ack.slotClock);
    return;
  }

  if (ack.action === 'reject') {
    rollbackIfStillRelevant(pending.patch, ack);
    removePending(ack.requestId);
    return;
  }

  if (ack.action === 'rebase') {
    applyRemotePatch(ack.actualPatch, { silent: true });
    removePending(ack.requestId);
    updateKnownSlotClock(ack.elementId, ack.slot, ack.actualPatch.slotClock);
    return;
  }
}
```

Quan trọng:

* Ack cũ đến muộn không được ghi đè pending mới hơn.
* Reject không được rollback mù nếu slot đã có pending mới hơn.
* Rebase apply silent, không trigger push lại.

---

## Sửa P5-11 — Idempotency + TTL

Server phải nhớ request đã xử lý để retry/reconnect không apply lại patch cũ.

```ts
interface ProcessedRequest {
  requestId: string;
  result: SlotPatchAck;
  createdAt: number;
}

const processedRequests = new Map<string, ProcessedRequest>();
```

Rule:

```txt
Nếu requestId đã xử lý:
  - Không apply lại state.
  - Gửi lại ack cho sender.
  - Không broadcast duplicate.
```

Thêm TTL để tránh tràn RAM:

```ts
const PROCESSED_REQUEST_TTL_MS = 10 * 60 * 1000; // 10 phút
```

Dọn định kỳ:

```ts
function cleanupProcessedRequests() {
  const now = Date.now();
  for (const [requestId, record] of processedRequests) {
    if (now - record.createdAt > PROCESSED_REQUEST_TTL_MS) {
      processedRequests.delete(requestId);
    }
  }
}
```

---

## Sửa P5-12 — Create/delete

Create/delete vẫn là operation riêng, không biểu diễn bằng patch thường.

```ts
interface CreateElementPayload {
  roomId: string;
  requestId: string;
  actorId: string;
  element: Element;
}

interface DeleteElementPayload {
  roomId: string;
  requestId: string;
  actorId: string;
  elementId: string;
}
```

Delete rule:

```txt
Delete-wins.
Element đã deleted thì mọi patch khác bị reject, trừ restore/undo tường minh nếu sau này có hỗ trợ.
```

Khi delete element, server cần repair binding:

```ts
function repairBindingsAfterDelete(deletedElementId: string) {
  for (const el of elements.values()) {
    if (el.type !== 'arrow') continue;

    if (el.startBinding?.elementId === deletedElementId) {
      clear startBinding;
      emit server patch for slot 'binding.start';
    }

    if (el.endBinding?.elementId === deletedElementId) {
      clear endBinding;
      emit server patch for slot 'binding.end';
    }
  }
}
```

---

## Sửa P5-14 — Snapshot/reconnect

Snapshot phải chứa cả element state và slot clocks.

```ts
interface RoomSnapshot {
  roomId: string;
  serverClock: number;
  elements: Element[];
  slotClocks: Record<string, Partial<Record<SyncSlot, number>>>;
}
```

Reconnect flow:

```ts
function onReconnect(snapshot: RoomSnapshot) {
  store.hydrate(snapshot.elements);
  updateKnownSlotClocks(snapshot.slotClocks);

  // Replay optimistic patches chưa ack để UI không nhảy ngược
  for (const pending of pendingByRequestId.values()) {
    applyLocalPatch(pending.patch, { silent: true });
    queueForResend(pending.patch);
  }

  flush();
}
```

Resend phải dùng lại cùng `requestId`, không sinh request mới.

---

## Sửa P5-15 — Persistence / Redis / memory

P5 tối thiểu:

```txt
Hot state: in-memory room
Durable state: PostgreSQL snapshot
```

Checkpoint:

```txt
- mỗi N patch đã commit
- hoặc mỗi 15 giây
- hoặc trước khi unload inactive room
```

Không thay hot state bằng Redis ở P5.

Nếu nâng cấp:

```txt
Redis Streams = WAL / durable patch log
PostgreSQL = snapshot định kỳ
In-memory = hot state để merge realtime
```

Không đọc/ghi Redis cho từng bước merge nếu không cần, vì hot path realtime nên ưu tiên memory.

Room lifecycle bắt buộc:

```txt
Nếu room không còn client active trong 5-10 phút:
  1. checkpoint snapshot
  2. clear room khỏi memory
  3. dọn presence
  4. giữ processed request cache theo TTL hoặc bỏ theo room unload
```

Memory limit nên có:

```ts
const MAX_ELEMENTS_PER_ROOM = 20_000;
const MAX_POINTS_PER_STROKE = 5_000;
const MAX_ACTIVE_ROOMS_PER_PROCESS = 500;
const INACTIVE_ROOM_TTL_MS = 10 * 60 * 1000;
```

Nếu vượt limit:

```txt
- reject create thêm element
- simplify/compress points
- unload inactive room
- route room mới sang process khác nếu có nhiều server
```

---

## Sửa P5-16 — Undo có điều kiện

Không undo mù.

Mỗi undo entry lưu clock sau khi thao tác của mình đã commit:

```ts
interface UndoEntry {
  elementId: string;
  slot: SyncSlot;
  inverseChanges: Record<string, unknown>;

  // slotClock sau khi patch gốc của user commit
  afterSlotClock: number;
}
```

Khi undo:

```ts
function undo(entry: UndoEntry) {
  const currentClock = getKnownSlotClock(entry.elementId, entry.slot);

  if (currentClock !== entry.afterSlotClock) {
    showConflictMessage(
      'Không thể undo an toàn vì phần này đã được người khác sửa sau đó.'
    );
    return;
  }

  sendPatch({
    requestId: uuidv4(),
    actorId,
    clientClock: nextClientClock(),
    elementId: entry.elementId,
    slot: entry.slot,
    baseClock: currentClock,
    changes: entry.inverseChanges,
  });
}
```

Rule:

```txt
Undo chỉ apply nếu slot chưa đổi kể từ thao tác của mình.
Nếu slot đã đổi, báo conflict và không undo tự động.
```

---

## Thêm section mới — Scale model

```md
## Scale model

Hệ thống có thể chạy nhiều sync server, nhưng một room tại một thời điểm chỉ được xử lý bởi một authoritative owner.

Ví dụ:

room-1 -> server A
room-2 -> server B
room-3 -> server C

Không cho cùng một room nhận patch đồng thời ở nhiều server khác nhau, vì khi đó latest-to-server wins không còn một thứ tự duy nhất.

Trong P5, có thể giả định chỉ chạy một Node.js process.

Nếu scale ngang:
- dùng sticky routing theo roomId;
- hoặc room actor;
- hoặc Redis Stream/Postgres transaction làm ordered sequencer theo room.

Multi-master CRDT/vector clock nằm ngoài scope.
```

---

## Thêm section mới — Fractional indexing cho order/zIndex

```md
## Order / zIndex

Fractional indexing chỉ áp dụng cho slot `order`.

Nếu app chưa có reorder/layer phức tạp, P5 có thể dùng `zIndex: number`.

Nếu muốn tránh reindex hàng loạt khi chèn layer vào giữa hai layer khác, dùng fractional index string:

A.order = "a"
B.order = "b"
X chèn giữa A và B => X.order = between("a", "b")

Lợi ích:
- reorder một element chỉ sửa chính element đó;
- không cần update hàng loạt sibling;
- giảm conflict khi nhiều người reorder.

P5 có thể để fractional indexing là optional/future nếu chưa cần.
```

---

## Acceptance criteria cần cập nhật

```md
- [ ] A kéo shape, B đổi fillColor cùng lúc => merge transform + fillColor.
- [ ] A đổi fillColor, B đổi strokeWidth cùng lúc => merge cả hai vì khác slot.
- [ ] A kéo shape, B resize cùng shape => cùng slot transform, latest-to-server wins.
- [ ] A sửa startBinding, B sửa endBinding => merge vì khác slot.
- [ ] Patch gửi với baseClock cũ cùng slot => server xử lý conflict theo latest-to-server.
- [ ] Patch khác slot dù baseClock cũ vẫn merge được.
- [ ] Reject luôn clear pending và rollback nếu patch vẫn relevant.
- [ ] Reject không rollback nếu slot đã có pending mới hơn.
- [ ] Undo chỉ chạy nếu current slotClock == afterSlotClock của undo entry.
- [ ] Reconnect hydrate snapshot, replay pending, resend cùng requestId.
- [ ] Duplicate requestId không apply state lần hai.
- [ ] Inactive room được checkpoint rồi unload khỏi memory.
- [ ] processedRequests có TTL, không tăng vô hạn.
- [ ] Delete element clear hoặc repair binding liên quan.
```