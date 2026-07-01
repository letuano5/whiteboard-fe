# Sync Refactor Plan v2

> Bản canonical đã chốt cho refactor sync, conflict handling, load room, reconnect, save,
> delete, binding và import/restore.
>
> Hướng chính: **slot-level LWW commands + server-authoritative SyncRoom + transactional
> persistence**. Lấy cảm hứng từ tldraw và Figma, nhưng tránh whole-element LWW kiểu Excalidraw
> cho collaboration nhiều người.

---

## 1. Mục tiêu

Refactor toàn bộ sync hiện tại thành một module riêng, gom:

- realtime synchronization;
- conflict handling;
- reconnect/load room;
- save/import/export/replace document;
- delete/tombstone;
- binding repair;
- persistence clock/diff;
- retry/idempotency.

Không còn nhiều đường sync song song. Code mới phải có **một authoritative path**:

```txt
local command
  -> optimistic local state
  -> SyncCommand
  -> room actor serialized execution
  -> server SyncRoom
  -> compute PlannedChangeSet
  -> DB transaction
  -> stamp CommittedChangeSet
  -> apply to room memory
  -> ack/broadcast
  -> client materialize server truth
```

Những contract cũ cần bị thay:

```txt
ELEMENT_UPDATE: Element[]
whole-element version/versionNonce conflict
applyRemoteElements(Element[]) as final network merge
DB write bypass SyncRoom
```

Thay bằng:

```txt
PATCH_SLOTS / CREATE_ELEMENT / UPDATE_ARROW_BINDING / DELETE_ELEMENTS / REPLACE_DOCUMENT
server authoritative documentClock
roomEpoch for replace-document boundaries
slot clocks
CommittedChangeSet
server ack/reject/rebase
ROOM_SNAPSHOT / ROOM_DIFF based on documentClock
```

---

## 2. Ý tưởng lấy từ hệ thống khác

### Figma

Figma coi document như map object/property. Hai user sửa hai property khác nhau thì merge được.
Hai user sửa cùng property thì server order quyết định winner. Server là sequencer, không dùng
client timestamp để quyết định.

Học từ Figma:

- không sync whole object nếu user chỉ sửa một phần;
- conflict unit nhỏ hơn element;
- server định nghĩa thứ tự commit;
- create/delete là action explicit, không phải property write mơ hồ.

### tldraw

tldraw sync-core dùng:

- authoritative room;
- client `push`;
- server trả kết quả kiểu `commit`, `discard`, hoặc `rebaseWithDiff`;
- client reconnect với `lastServerClock`;
- storage transactional gồm records, tombstones, metadata/documentClock;
- `getChangesSince(clock)` để reconnect;
- binding có lifecycle riêng, không chỉ là string id.

Học từ tldraw:

- `SyncRoom` là owner duy nhất của room state;
- diff/change set là primitive;
- storage transaction tăng clock và ghi records/tombstones;
- reconnect không cần full snapshot nếu còn tombstone history;
- arrow binding cần domain lifecycle hook để repair khi shape/binding/delete thay đổi.

### Excalidraw

Excalidraw dùng whole-element reconciliation với `version` và `versionNonce`. Cách này đơn giản,
nhưng nếu A kéo shape và B đổi màu cùng shape, một bên có thể mất thay đổi.

Chỉ dùng Excalidraw làm đối chứng:

- phù hợp app đơn giản hơn;
- không phù hợp mục tiêu merge transform/style/text độc lập;
- không dùng `version/versionNonce` làm conflict source chính cho refactor này.

---

## 3. Kiến trúc dữ liệu: SyncSlot

`SyncSlot` là đơn vị conflict nhỏ nhất. Một slot có thể là một group field phụ thuộc nhau, hoặc
một field độc lập.

```ts
type SyncSlot =
  | 'transform.position'
  | 'transform.size'
  | 'transform.rotation'
  | 'style.fillColor'
  | 'style.strokeColor'
  | 'style.strokeWidth'
  | 'style.strokeStyle'
  | 'style.opacity'
  | 'style.roughness'
  | 'text.content'
  | 'text.fontSize'
  | 'text.fontFamily'
  | 'text.textAlign'
  | 'geometry.points'
  | 'geometry.route'
  | 'geometry.startPoint'
  | 'geometry.endPoint'
  | 'binding.start'
  | 'binding.end'
  | 'order'
  | 'asset.src'
  | 'embed.url'
  | 'grouping.groupId'
  | 'grouping.frameId';
```

Delete không phải patch slot bình thường. Delete chỉ đi qua `DeleteElementsCommand`. Nếu `Element`
còn field legacy như `isDeleted`, field đó không được client gửi bằng `SlotPatch`.

Server lưu clock theo slot:

```ts
interface SlotMeta {
  clock: number; // bằng documentClock tại lần cuối slot này thay đổi
  lastActorId?: string;
  lastRequestId?: string;
}

interface ElementSyncMeta {
  slots: Partial<Record<SyncSlot, SlotMeta>>;
}
```

Giải thích:

- `documentClock`: clock toàn room/document, tăng một lần sau mỗi committed command.
- `slot.clock`: `documentClock` tại lần cuối slot đó thay đổi.
- Client không gửi current slot clock. Client gửi `baseClock`, là clock của slot mà client đã thấy
  lúc tạo patch.
- Slot chưa từng set có clock `0`. Protocol sau normalization không dùng `null` cho clock.

Phân biệt rõ:

```txt
Atomic update:
  Nhóm thay đổi phải commit cùng nhau để state không hỏng.

Conflict slot:
  Đơn vị LWW khi hai user sửa cùng một phần semantic.
```

Hai khái niệm này không bắt buộc giống nhau. Một command có thể touch nhiều slot atomically, ví dụ
binding update touch `binding.start` và geometry server-derived. Nhưng conflict slot vẫn phải đủ
nhỏ để UX không quay lại whole-element LWW.

Clock trong DB là `BigInt`. Clock trong JSON protocol dùng `number` với assert
`Number.isSafeInteger`. Nếu sau này clock có thể vượt `Number.MAX_SAFE_INTEGER`, đổi wire protocol
sang `ClockString`.

```ts
function toProtocolClock(clock: bigint): number {
  const value = Number(clock);
  if (!Number.isSafeInteger(value)) throw new Error('CLOCK_OVERFLOW');
  return value;
}

function normalizeClock(clock: number | null | undefined): number {
  return clock ?? 0;
}
```

---

## 4. Field-to-slot mapping

Mapping phải exhaustive. Mỗi mutable field phải map vào một slot, hoặc ghi rõ là non-sync /
derived / legacy-only.

```ts
const FIELD_TO_SLOT = {
  x: 'transform.position',
  y: 'transform.position',
  width: 'transform.size',
  height: 'transform.size',
  angle: 'transform.rotation',

  fillColor: 'style.fillColor',
  strokeColor: 'style.strokeColor',
  strokeWidth: 'style.strokeWidth',
  strokeStyle: 'style.strokeStyle',
  opacity: 'style.opacity',
  roughness: 'style.roughness',

  text: 'text.content',
  fontSize: 'text.fontSize',
  fontFamily: 'text.fontFamily',
  textAlign: 'text.textAlign',

  points: 'geometry.points',

  startBinding: 'binding.start',
  endBinding: 'binding.end',

  zIndex: 'order',

  src: 'asset.src',
  url: 'embed.url',

  groupId: 'grouping.groupId',
  frameId: 'grouping.frameId',
} as const;
```

Rule:

- `transform.position` gom `x/y`. Move vs move LWW.
- `transform.size` gom `width/height`. Resize vs resize LWW.
- `transform.rotation` là `angle`. Rotate vs rotate LWW.
- Move vs resize cùng shape merge được vì khác slot.
- Style tách riêng để A đổi `fillColor`, B đổi `strokeWidth` vẫn merge được.
- `binding.start` và `binding.end` tách riêng để hai đầu arrow có thể merge.
- Geometry của linear/arrow cần mapping theo operation:
  - freehand/line full points: `geometry.points`;
  - arrow route/path giữa hai endpoint: `geometry.route`;
  - unbound arrow endpoints: `geometry.startPoint` / `geometry.endPoint`;
  - bound arrow endpoints là server-derived từ binding, client không patch trực tiếp.
- `order` tách riêng để sau này có thể migrate `zIndex` number sang fractional index string.
  Phase đầu không cho client gửi `PatchSlotsCommand` trực tiếp cho slot `order`; create/reorder phải
  đi qua command domain để server normalize deterministic.
- Linear elements không được nhận `transform.*` patch độc lập. Xem section linear elements.

---

## 5. Protocol: SlotPatch và SyncCommand

`SlotPatch` là primitive cho thay đổi đơn-slot bên trong một command. `requestId`, `actorId`,
`clientClock` và `baseRoomEpoch` thuộc command, không thuộc từng patch.

```ts
interface SlotPatch {
  elementId: string;
  slot: SyncSlot;

  // Clock của slot tại thời điểm client tạo patch.
  // Slot chưa từng set dùng 0, không dùng null trong protocol sau normalization.
  baseClock: number;

  // Chỉ chứa field thuộc slot này.
  changes: Record<string, unknown>;

  // Dùng cho undo có điều kiện.
  inverseChanges?: Record<string, unknown>;
}
```

Patch phải chứa **full value của semantic slot**, không gửi nửa slot:

```txt
transform.position => changes phải có đủ x, y
transform.size => changes phải có đủ width, height
transform.rotation => changes phải có angle
geometry.points => full points value cho line/freehand
geometry.route => full route/path value của arrow
geometry.startPoint/endPoint => full endpoint value nếu endpoint unbound
style.* / text.* / asset.* / embed.* => field đơn tương ứng
```

Nếu command chỉ gửi một phần của semantic slot, server reject `INVALID_FIELD`. Rule này giữ LWW
đúng nghĩa ở cấp slot: cùng slot thì patch đến sau thay cả slot, khác slot thì merge.

Tuy nhiên không phải operation nào cũng là một `SlotPatch` đơn. Những operation có side effect
hoặc phải sửa nhiều slot cùng lúc phải đi qua `SyncCommand`.

```ts
interface SlotReadPrecondition {
  elementId: string;
  slot: SyncSlot;
  baseClock: number;
  onStale: 'reject' | 'rebase' | 'server_recompute';
}

interface SyncCommandBase {
  protocolVersion: 2;
  schemaVersion: number;
  roomId: string;
  requestId: string;
  clientClock: number;

  // Epoch mà client đang đứng trên. Replace document sẽ cập nhật roomEpoch.
  baseRoomEpoch: number;

  // Các slot command đọc để tính toán nhưng không nhất thiết ghi.
  readPreconditions?: SlotReadPrecondition[];
}

type SyncCommand =
  | CreateElementCommand
  | ReorderElementsCommand
  | PatchSlotsCommand
  | UpdateArrowBindingCommand
  | DeleteElementsCommand
  | ReplaceDocumentCommand;

interface PatchSlotsCommand extends SyncCommandBase {
  kind: 'patch_slots';
  patches: SlotPatch[];
}
```

`PatchSlotsCommand` là atomic batch:

```txt
Nếu bất kỳ patch nào invalid cứng như INVALID_FIELD / INVALID_VALUE / ELEMENT_DELETED:
  reject toàn bộ command.

Nếu patch stale base cùng slot:
  không reject, accept theo latest-to-server wins.

Một command có một requestId và nhận một ACK.
Không dùng batchId riêng trong protocol phase đầu.

PatchSlotsCommand chỉ dùng trực tiếp cho slot độc lập tuyệt đối. Nếu patch được tính từ slot khác,
command phải thêm `readPreconditions`, hoặc dùng domain command riêng để server recompute.
```

Server không tin `actorId` từ payload. `actorId` lấy từ authenticated socket/session, rồi gắn vào
`AuthenticatedSyncCommand` nội bộ.

```ts
type AuthenticatedSyncCommand = SyncCommand & {
  actorId: string;
};
```

Ví dụ kéo shape trong một `PatchSlotsCommand`:

```ts
{
  elementId: 'shape-1',
  slot: 'transform.position',
  baseClock: 42,
  changes: { x: 120, y: 240 },
  inverseChanges: { x: 80, y: 200 },
}
```

Ví dụ đổi màu fill trong một `PatchSlotsCommand`:

```ts
{
  elementId: 'shape-1',
  slot: 'style.fillColor',
  baseClock: 45,
  changes: { fillColor: '#ff0000' },
  inverseChanges: { fillColor: '#ffffff' },
}
```

---

## 6. Client mutation pipeline

Mỗi local mutation tạo patch từ before/after:

```txt
1. capture before
2. apply local state optimistic
3. capture after
4. diff before/after
5. group changed fields by SyncSlot
6. create SlotPatch[] hoặc SyncCommand
7. add to pending queue
8. flush through socket
```

Coalesce patch theo:

```ts
const patchSlotKey = `${elementId}:${slot}`;
const FLUSH_MS = 33;
```

Trong một flush window, nếu cùng element + cùng slot bị sửa nhiều lần, chỉ gửi patch cuối. Không
coalesce giữa slot khác nhau.

Khi coalesce nhiều patch cùng `elementId + slot`:

```txt
changes lấy từ after cuối cùng.
inverseChanges lấy từ before đầu tiên trong window.
baseClock lấy từ knownSlotClock tại before đầu tiên.
```

Ví dụ kéo `x = 0 -> 10 -> 20 -> 30`: patch gửi `x = 30`, nhưng `inverseChanges.x = 0`, không phải
`20`.

Client phải giữ pending theo `requestId` và biết request đó thuộc `documentClock`/snapshot nào.
Sau `ROOM_REPLACED`, pending cũ bị cancel.

Client giữ hai lớp state:

```txt
serverState:
  state authoritative gần nhất đã apply đầy đủ từ server.

optimisticState:
  serverState + pending local commands replay theo thứ tự local.
```

Mỗi khi nhận `ACK` hoặc realtime `BROADCAST`:

```ts
function reconcileFromServer(changeSet: CommittedChangeSet, ackedRequestId?: string) {
  if (changeSet.serverClock <= lastServerClock) {
    if (ackedRequestId) removePending(ackedRequestId);
    return;
  }

  if (changeSet.serverClock > lastServerClock + 1) {
    bufferChangeSet(changeSet);
    requestRoomDiff(lastServerClock);
    return;
  }

  if (changeSet.originActorId === myActorId) {
    for (const requestId of changeSet.originRequestIds) {
      removePending(requestId);
    }
  }

  applyServerChangeSetSlotAware(serverState, changeSet);
  updateKnownClocks(changeSet);

  if (ackedRequestId) {
    removePending(ackedRequestId);
  }

  optimisticState = cloneServerState(serverState);

  for (const pending of pendingQueue.inOrder()) {
    applyPendingOptimistic(optimisticState, pending);
  }

  render(optimisticState);
}
```

Không chỉ ACK mới clear pending. Bất kỳ `CommittedChangeSet` nào đến từ ACK hoặc realtime broadcast
mà chứa `originRequestIds` của chính client đều phải remove pending request đó trước khi replay
optimistic.

`ROOM_DIFF` phase đầu không có `originRequestIds` vì plan không thêm ChangeLog/WAL. Khi reconnect,
client gửi `pendingRequestIds`; server check `ProcessedRequest` và trả pending statuses/ack replay
riêng. Diff chỉ dùng để hydrate server state theo slot-aware semantics.

ACK/broadcast monotonic guard:

```txt
changeSet.serverClock <= lastServerClock:
  ignore duplicate/old state. Nếu là ACK thì chỉ clear pending request tương ứng.

changeSet.serverClock > lastServerClock + 1:
  buffer event, request ROOM_DIFF từ lastServerClock, rồi resume sau khi diff apply xong.
```

Client không được apply server `puts` bằng cách replace nguyên element cho mutation nhỏ. Client chỉ
copy các field thuộc các slot xuất hiện trong `changeSet.slotPatches` hoặc
`changeSet.slotClocks`. Slot không xuất hiện trong change set không được overwrite local
optimistic view.

ROOM_DIFF apply slot-aware:

```ts
function applyRoomDiff(diff: RoomDiff, previousLastServerClock: number) {
  for (const el of diff.changed) {
    const clocks = diff.slotClocks[el.id] ?? {};

    for (const [slot, clock] of Object.entries(clocks)) {
      if (clock > previousLastServerClock) {
        const value = extractSlotValue(el, slot as SyncSlot);
        applySlotValue(serverState, el.id, slot as SyncSlot, value);
        knownSlotClock[el.id][slot as SyncSlot] = clock;
      }
    }
  }

  applyDeletes(diff.deleted);
  lastServerClock = diff.serverClock;
  replayPending();
}
```

Không replace whole `changed: Element[]` trong `ROOM_DIFF` trừ khi đó là `ROOM_SNAPSHOT wipe_all`
hoặc create/new element chưa có trong `serverState`.

`lastServerClock` nghĩa là document clock mới nhất đã apply đầy đủ vào `serverState`.
`knownSlotClock[elementId][slot]` nghĩa là clock mới nhất của slot đó. Không lấy max slot clock lẻ
rồi coi là đã apply full document clock.

Gap detection:

```txt
Nếu nhận realtime changeSet với serverClock > lastServerClock + 1:
  pause realtime apply
  request ROOM_DIFF từ lastServerClock
  apply diff
  replay pending
  resume stream
```

WebSocket ordered trong một connection, nhưng reconnect/transient disconnect vẫn có thể miss event.

Pending create dependency:

```txt
Mutation vào element chưa ACK create:
  - nếu CreateElementCommand chưa gửi: squash field mới vào element của create command.
  - nếu CreateElementCommand đã gửi: patch/delete phụ thuộc create phải giữ dependency order.
  - reconnect/resend không được gửi patch/delete của pending-created element trước create.
  - nếu delete xảy ra trước khi create được gửi: cancel create local, không gửi gì.
```

Drag/backpressure:

```txt
Phase đầu có thể commit durable theo flush window, nhưng phải có max in-flight commands.
Nếu pending/in-flight quá nhiều:
  coalesce command chưa gửi;
  drop intermediate drag patches đã bị final patch supersede;
  luôn gửi final pointerup patch.
```

Nếu DB transaction 33ms gây đau, tăng flush/debounce cho durable patch lên 50-100ms và dùng
presence/transient preview cho cảm giác realtime trong lúc drag.

---

## 7. Server authoritative SyncRoom

Server giữ hot state của room:

```ts
class SyncRoom {
  roomId: string;
  documentClock = 0;

  elements = new Map<string, Element>();
  slotClocks = new Map<string, Partial<Record<SyncSlot, number>>>();

  processedRequests = new Map<string, ProcessedRequest>();
}
```

Giả định phase đầu:

```txt
Một room tại một thời điểm chỉ có một authoritative owner.
Trong scope đồ án có thể là một Node.js process.
Nếu scale ngang: cần sticky routing theo roomId, room actor, hoặc ordered sequencer.
Multi-master CRDT/vector clock nằm ngoài scope.
```

Mỗi room phải có serialized executor/room actor. Không command nào được `planCommand` trên memory
của room trong khi command trước đã planned nhưng chưa `applyCommitted`.

```ts
await roomActor.enqueue(command.roomId, async () => {
  const processed = await repository.findProcessedRequest(command, actorId);
  if (processed) {
    transport.enqueueAck(replayOrRejectDuplicate(processed, command));
    return;
  }

  const planned = room.planCommand(command);
  const committed = await repository.commit(planned);
  room.applyCommitted(committed.changeSet);

  transport.enqueueAck(committed.ack);
  transport.enqueueBroadcast(committed.changeSet);
});
```

Critical section bao gồm `planCommand`, `repository.commit`, `applyCommitted` và enqueue output
theo đúng thứ tự clock. Không await network delivery của client trong critical section.

Mọi merge xảy ra ở server. Client không tự quyết final state.

---

## 8. Conflict resolution

Rule chính:

```txt
Khác slot => merge.
Cùng slot => latest-to-server wins.
Delete => delete-wins.
```

Pseudo:

```ts
function planPatch(patch: SlotPatch): PlannedPatchResult {
  const el = elements.get(patch.elementId);
  if (!el) return reject('ELEMENT_NOT_FOUND');

  const validation = validateSlotPatch(el, patch);
  if (!validation.ok) return reject(validation.reason);

  const currentClock = getSlotClock(patch.elementId, patch.slot);
  const baseClock = normalizeClock(patch.baseClock);

  if (baseClock === currentClock) {
    return commitClean(patch);
  }

  if (baseClock > currentClock) {
    return reject('STALE_CLIENT_STATE');
  }

  return commitConflictLww(patch, {
    reason: 'STALE_BASE_LATEST_TO_SERVER_WINS',
  });
}
```

Semantics:

```txt
baseClock == currentSlotClock:
  commit clean

baseClock < currentSlotClock:
  conflict cùng slot
  latest-to-server wins
  server vẫn accept patch mới
  ack action = rebase nếu client cần materialize lại server truth

baseClock > currentSlotClock:
  client đang đứng trên state mà server không có, thường do gap/reconnect bug
  reject STALE_CLIENT_STATE và yêu cầu client fetch ROOM_DIFF hoặc ROOM_SNAPSHOT
```

Không dùng:

- `Date.now()` của client để quyết định winner;
- client timestamp;
- `clientClock` giữa nhiều client.

`clientClock` chỉ dùng để debug/order local pending.

---

## 9. Validation

Validation phải chạy ở server trước khi tạo `CommittedChangeSet`.

Reject reasons tối thiểu:

```ts
type RejectReason =
  | 'ROOM_NOT_FOUND'
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_DELETED'
  | 'INVALID_SLOT'
  | 'INVALID_FIELD'
  | 'INVALID_VALUE'
  | 'INVALID_SLOT_FOR_ELEMENT_TYPE'
  | 'INVALID_BINDING_TARGET'
  | 'DUPLICATE_ELEMENT_ID'
  | 'DUPLICATE_REQUEST_CONFLICT'
  | 'TOO_LARGE'
  | 'CLOCK_OVERFLOW'
  | 'STALE_CLIENT_STATE'
  | 'STALE_ROOM_EPOCH'
  | 'FORBIDDEN'
  | 'UNSUPPORTED_COMMAND'
  | 'UNSUPPORTED_PROTOCOL_VERSION'
  | 'UNSUPPORTED_SCHEMA_VERSION';
```

Auth/permission chạy trước `planCommand`:

```txt
authenticate socket/session
load actorId from session
authorize actor can edit room
if command.protocolVersion !== 2: reject UNSUPPORTED_PROTOCOL_VERSION
if command.schemaVersion !== CURRENT_SCHEMA_VERSION: reject UNSUPPORTED_SCHEMA_VERSION
if command.baseRoomEpoch !== room.roomEpoch: reject STALE_ROOM_EPOCH
reject FORBIDDEN nếu không có quyền
```

Áp dụng cho mọi command:

```txt
CREATE_ELEMENT
REORDER_ELEMENTS
PATCH_SLOTS
UPDATE_ARROW_BINDING
DELETE_ELEMENTS
REPLACE_DOCUMENT
```

`PatchSlotsCommand` atomic:

```txt
Nếu một patch invalid cứng: reject toàn bộ command.
Nếu một patch stale base cùng slot: accept theo LWW, không reject.
Nếu command vượt size/patch limit: reject TOO_LARGE.
Nếu patch.slot === 'order': reject INVALID_SLOT trong phase đầu; dùng ReorderElementsCommand sau.
Sau normalization không được có duplicate (elementId, slot).
Nếu có duplicate thì server coalesce deterministic theo rule client hoặc reject INVALID_FIELD.
```

`actorId` trong payload không phải source of truth. Nếu client gửi kèm để debug, server chỉ dùng
để assert nó khớp session actorId.

Rules:

```ts
if (isLinearElement(el) && patch.slot.startsWith('transform.')) {
  return reject('INVALID_SLOT_FOR_ELEMENT_TYPE');
}

if (!fieldsBelongToSlot(patch.changes, patch.slot)) {
  return reject('INVALID_FIELD');
}

if (!isFullSemanticSlotValue(patch.changes, patch.slot)) {
  return reject('INVALID_FIELD');
}

if (patch.slot === 'order') {
  return reject('INVALID_SLOT');
}

if (containsDerivedOrLocalOnlyField(patch.changes)) {
  return reject('INVALID_FIELD');
}

if (patch.slot === 'binding.start' || patch.slot === 'binding.end') {
  if (!validateBindingTarget(patch)) {
    return reject('INVALID_BINDING_TARGET');
  }
}

if (isBoundArrowEndpointGeometryPatch(el, patch)) {
  return reject('INVALID_SLOT_FOR_ELEMENT_TYPE');
}
```

Read preconditions:

```txt
Nếu command ghi slot A nhưng tính toán dựa trên slot B, command phải khai báo readPrecondition cho
slot B hoặc dùng domain command để server recompute.

Ví dụ:
  geometry.route phụ thuộc binding.start/binding.end
  geometry.startPoint/endPoint phụ thuộc binding terminal
  order phụ thuộc order list
  grouping/frame phụ thuộc reference graph
  target transform repair phụ thuộc binding reverse index

Nếu read precondition stale:
  onStale = reject => reject STALE_CLIENT_STATE
  onStale = rebase => accept/rebase nếu domain vẫn safe
  onStale = server_recompute => bỏ giá trị client tính và recompute từ server-current state
```

Delete không được đi qua `SlotPatch`. Nếu client gửi patch vào deleted element hoặc patch kiểu
`isDeleted`, server reject.

Derived/server-only/local-only fields không được client patch:

```txt
bounds/cache/computed bbox
version/versionNonce nếu chỉ còn legacy
updatedAt/local timestamp
selection/hover/editing state
transient render/cache fields
```

Bound arrow geometry:

```txt
Nếu arrow endpoint đang bound:
  client không được patch trực tiếp geometry.startPoint/endPoint của endpoint đó.
  Muốn đổi endpoint phải dùng UpdateArrowBindingCommand.
  Muốn chỉnh route/path giữa hai endpoint thì dùng geometry.route và không được thay endpoint bound.
```

Limits tối thiểu:

```ts
const MAX_PATCHES_PER_COMMAND = 128;
const MAX_ELEMENTS_PER_DELETE = 128;
const MAX_REPAIRED_ARROWS_PER_COMMAND = 512;
const MAX_CHANGESET_BYTES = 1_000_000;
```

Nếu command vượt limit, reject `TOO_LARGE`. Với document lớn hơn, sau này có thể split bằng
server-side repair job/command sequence.

---

## 10. PlannedChangeSet và CommittedChangeSet

`planCommand` không tạo `CommittedChangeSet` hoàn chỉnh vì lúc đó chưa có clock mới. Nó tạo
`PlannedChangeSet`. Repository commit trong DB transaction sẽ stamp `serverClock` và trả
`CommittedChangeSet`.

```ts
type ChangeSetReason =
  | 'create'
  | 'patch_clean'
  | 'patch_lww_conflict'
  | 'binding_update'
  | 'delete'
  | 'replace_document'
  | 'repair';

interface PlannedSlotPatch {
  elementId: string;
  slot: SyncSlot;
  changes: Record<string, unknown>;
}

interface PlannedChangeSet {
  roomId: string;
  originActorId: string;
  originRequestIds: string[];
  reason: ChangeSetReason;
  slotPatches: PlannedSlotPatch[];
  puts: Element[];
  deletes: string[];
  touchedSlots: { elementId: string; slot: SyncSlot }[];
}

interface CommittedSlotPatch extends PlannedSlotPatch {
  clock: number;
}

interface CommittedChangeSet extends Omit<PlannedChangeSet, 'slotPatches' | 'touchedSlots'> {
  serverClock: number;
  roomEpoch: number;
  slotPatches: CommittedSlotPatch[];
  slotClocks: SlotClockUpdate[];
}

interface SlotClockUpdate {
  elementId: string;
  slot: SyncSlot;
  clock: number;
}
```

Mọi accepted command sinh ra một `CommittedChangeSet`. Đây là server truth duy nhất để ack,
broadcast, persist, replay và reconnect.

`slotPatches` là payload client dùng để apply mutation nhỏ theo slot-aware semantics. `puts` là
server materialized element dùng cho create, replace, reconnect, debug và persistence. Với
`patch_clean`, `patch_lww_conflict`, `binding_update`, `delete` repair, client không được hiểu
`puts` là lệnh replace whole element.

Mỗi `slotPatches[]` cũng phải chứa full semantic slot value giống `SlotPatch.changes`. Client apply
slot patch bằng cách thay value của slot đó trong `serverState`, không merge field con bên trong
cùng slot.

Mọi repaired arrow do delete, binding update hoặc target-transform/target-geometry repair phải
emit `slotPatches` đầy đủ cho các slot bị đổi như `binding.start`, `binding.end`,
`geometry.route`, `geometry.startPoint`, `geometry.endPoint`. `puts` chỉ là materialized element
cho persistence/debug/reconnect, không phải instruction apply chính cho client.

Invariant:

```txt
Tất cả recordClock / deletedClock / slotClock touched trong cùng command đều bằng cùng một
serverClock mới.
```

Ví dụ delete 3 shape và repair 5 arrow:

```txt
documentClock = 100
deletedClock của 3 shape = 100
recordClock của 5 arrow repaired = 100
slotClock binding/geometry của 5 arrow = 100
```

Không tăng clock nhiều lần trong một command.

---

## 11. Ack / reject / rebase

Server trả ack riêng cho sender. Ack phải chứa actual committed change, vì server có thể normalize
geometry, recompute binding, repair arrows hoặc reject stale room.

```ts
type SyncAck =
  | {
      protocolVersion: 2;
      schemaVersion: number;
      action: 'commit';
      requestId: string;
      serverClock: number;
      changeSet: CommittedChangeSet;
    }
  | {
      protocolVersion: 2;
      schemaVersion: number;
      action: 'rebase';
      requestId: string;
      serverClock: number;
      changeSet: CommittedChangeSet;
    }
  | {
      protocolVersion: 2;
      schemaVersion: number;
      action: 'reject';
      requestId: string;
      serverClock: number;
      reason: RejectReason;
      serverChangeSet?: CommittedChangeSet;
    };
```

Tên gọi:

- `commit`: command accepted, base match, server materialization khớp với expectation.
- `rebase`: command accepted nhưng base stale hoặc server normalize làm actual state khác optimistic.
- `reject`: invalid/forbidden/deleted/duplicate/stale epoch.

Broadcast cho peers:

```ts
interface SyncBroadcast {
  protocolVersion: 2;
  schemaVersion: number;
  roomId: string;
  serverClock: number;
  changeSet: CommittedChangeSet;
}
```

Sender có thể không cần nhận broadcast của chính mình vì ack đã có `changeSet`. Nếu sau này muốn
đơn giản hóa client, có thể broadcast cho cả sender, nhưng vẫn giữ ack để clear pending/retry.

Client khi nhận ack:

```ts
function onAck(ack: SyncAck) {
  const pending = pendingByRequestId.get(ack.requestId);
  if (!pending) return;

  if (ack.action === 'commit' || ack.action === 'rebase') {
    reconcileFromServer(ack.changeSet, ack.requestId);
    return;
  }

  removePending(ack.requestId);
  rebuildOptimisticStateFromServerStateAndPending();
}
```

Quan trọng:

- Ack cũ đến muộn không được overwrite pending mới hơn.
- Reject không rollback mù nếu slot đã có pending mới hơn.
- Rebase đi qua `reconcileFromServer`, không trigger push lại.
- Sau `ROOM_REPLACED`, ack của request không còn trong pending queue bị ignore.
- Broadcast realtime chỉ apply trực tiếp nếu không tạo gap `serverClock`; nếu có gap thì fetch
  `ROOM_DIFF`.

---

## 12. Idempotency

Server phải nhớ request đã xử lý để retry/reconnect không apply lại patch cũ.

Key:

```ts
const processedKey = `${roomId}:${actorId}:${requestId}`;
```

Idempotency check phải chạy ở **command boundary trước validation domain**:

```ts
async function handleCommand(command: SyncCommand, actorId: string) {
  const payloadHash = hashCanonicalCommand(command);

  return roomActor.enqueue(command.roomId, async () => {
    const existing = await repository.findProcessedRequest(command.roomId, actorId, command.requestId);

    if (existing) {
      if (existing.payloadHash === payloadHash) return replayAck(existing);
      return reject('DUPLICATE_REQUEST_CONFLICT');
    }

    return planCommitApply(command, actorId, payloadHash);
  });
}
```

Không được validate duplicate element trước idempotency. Nếu không, retry của
`CreateElementCommand` đã commit nhưng mất ACK sẽ bị reject nhầm `DUPLICATE_ELEMENT_ID` thay vì
replay ACK cũ.

Memory cache có thể làm fast path trước khi vào actor, nhưng durable `ProcessedRequest`/unique
constraint trong DB mới là nguồn đúng sau restart.

Memory cache vẫn hữu ích cho hot path:

```ts
interface ProcessedRequest {
  roomId: string;
  actorId: string;
  requestId: string;
  payloadHash: string;
  serverClock: number;
  result: SyncAck;
  createdAt: number;
}
```

Nhưng chỉ memory TTL là chưa đủ. Case lỗi:

```txt
server commit req-1, ACK mất
server restart
client reconnect resend req-1
memory processedRequests mất
server apply lại req-1
```

Vì vậy phase đầu nên thêm bảng durable idempotency nhỏ trong Postgres:

```prisma
model ProcessedRequest {
  roomId      String   @db.Uuid
  actorId     String
  requestId   String
  payloadHash String
  clock       BigInt
  action      String
  reason      String?
  result      Json?
  createdAt   DateTime @default(now())

  @@id([roomId, actorId, requestId])
  @@index([roomId, createdAt])
}
```

Rule:

```txt
Nếu request đã xử lý:
  - Nếu payloadHash giống: không mutate state lần hai, trả lại ack/result cũ.
  - Nếu payloadHash khác: reject DUPLICATE_REQUEST_CONFLICT.
  - Không broadcast duplicate.
```

`payloadHash` phải được tính từ canonical command payload sau normalization, không gồm transient
debug field hoặc actorId client tự khai.

GC:

```txt
Giữ ProcessedRequest tối thiểu 24h hoặc theo retention window phù hợp.
Khi record idempotency quá cũ bị xóa, client offline quá lâu phải full snapshot và không resend
blindly các pending cũ.
Nếu bật GC, cập nhật Room.processedRequestHistoryStartsAtClock theo clock nhỏ nhất còn có thể
replay idempotency an toàn.
```

Phase đầu có thể lưu `result Json` để debug và re-ACK đơn giản. Khi optimize, không lưu full
`Element[]` hoặc full `CommittedChangeSet` lâu dài trong `ProcessedRequest`; có thể lưu tối thiểu
`action`, `reason`, `clock`, rồi reconstruct hoặc yêu cầu client fetch diff.

---

## 13. Persistence: Postgres là source of truth, Redis optional, không thêm MongoDB

### Quyết định

Không thêm MongoDB cho sync core.

Postgres đủ tốt cho durable sync vì:

- cần transaction mạnh giữa `Record`, `Tombstone`, `SlotClock`, `ProcessedRequest`;
- cần unique constraint cho idempotency;
- cần query diff theo `recordClock/deletedClock/slotClock`;
- cần consistency hơn là write fire-and-forget;
- project đã dùng Prisma/PostgreSQL ở P3A+.

Hot path không nên đọc/ghi Postgres cho từng pixel move theo nghĩa "mỗi mousemove một DB write".
Client phải coalesce local patch, server batch command, rồi chỉ ack sau khi DB transaction commit.

Kiến trúc phase đầu:

```txt
SyncRoom memory:
  hot authoritative state trong process

Postgres:
  durable source of truth
  transaction boundary trước khi ACK

Redis:
  chưa cần trong phase đầu
```

Khi nào cần Redis:

- scale ngang nhiều Node process;
- pub/sub broadcast giữa room owners;
- distributed lock hoặc room ownership lease;
- ephemeral presence/cache/rate limit;
- giảm query reconnect bằng short-lived cache.

Redis không thay Postgres làm source of truth. Nếu Redis mất data, document vẫn phải recover được từ
Postgres.

Không nên thêm MongoDB chỉ để "nhanh hơn":

- thêm một database nghĩa là thêm consistency boundary;
- sync cần transaction multi-table rõ ràng hơn là document store linh hoạt;
- MongoDB không giải quyết vấn đề chính là authoritative ordering + idempotency + diff clock;
- vận hành phức tạp hơn trong khi lợi ích phase này thấp.

### WAL là gì?

WAL = Write-Ahead Log. Nghĩa là ghi log thao tác trước, rồi mới coi thao tác là committed.

```txt
Client gửi PATCH req-123

Server:
  1. validate
  2. append sync_operations { clock: 42, type: 'patch', payload: ... }
  3. apply operation
  4. ACK + broadcast
```

Restart:

```txt
load snapshot gần nhất
replay sync_operations sau snapshotClock
=> khôi phục đúng committed state
```

### Quyết định cho project

Không cần WAL riêng ngay. Bám sát tldraw hơn:

```txt
Record(state, recordClock)
Tombstone(deletedClock)
SlotClock(elementId, slot, clock)
Room(documentClock, tombstoneHistoryStartsAtClock)
ProcessedRequest(roomId, actorId, requestId, payloadHash, result)
```

Mỗi accepted command được persist trong **một DB transaction**. Server chỉ gửi `ACK` sau khi
transaction thành công. WAL/`SyncOperation` là optional cho version history/audit/replay sau này.

---

## 14. DB schema target

Giữ `Room`, `Record`, `Tombstone`, thêm `SlotClock` và `ProcessedRequest`.

Phase đầu dùng bảng `SlotClock` riêng vì dễ debug, dễ query diff và dễ validate. Nếu số row
`elements x slots` quá lớn, có thể migrate `slotClocks` vào JSON metadata của `Record`, ví dụ:

```txt
Record {
  state Json
  recordClock BigInt
  slotClocks Json
}
```

```prisma
model Room {
  id                            String      @id @default(uuid()) @db.Uuid
  name                          String      @default("Untitled")
  ownerId                       String?
  documentClock                 BigInt      @default(0)
  roomEpoch                     BigInt      @default(0)
  tombstoneHistoryStartsAtClock BigInt      @default(0)
  processedRequestHistoryStartsAtClock BigInt @default(0)
  createdAt                     DateTime    @default(now())
  updatedAt                     DateTime    @updatedAt
  records                       Record[]
  tombstones                    Tombstone[]
  slotClocks                    SlotClock[]
}

model Record {
  roomId      String @db.Uuid
  recordId    String
  typeName    String
  state       Json
  recordClock BigInt
  room        Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@id([roomId, recordId])
  @@index([roomId, recordClock])
}

model Tombstone {
  roomId       String @db.Uuid
  recordId     String
  deletedClock BigInt
  room         Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@id([roomId, recordId])
  @@index([roomId, deletedClock])
}

model SlotClock {
  roomId   String @db.Uuid
  recordId String
  slot     String
  clock    BigInt
  room     Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@id([roomId, recordId, slot])
  @@index([roomId, clock])
}

model ProcessedRequest {
  roomId      String   @db.Uuid
  actorId     String
  requestId   String
  payloadHash String
  clock       BigInt
  action      String
  reason      String?
  result      Json?
  createdAt   DateTime @default(now())

  @@id([roomId, actorId, requestId])
  @@index([roomId, createdAt])
}
```

DB transaction cho commit:

```txt
1. SELECT Room FOR UPDATE / atomic increment documentClock once
2. assign newClock = documentClock + 1
3. persist Record puts with recordClock = newClock
4. persist Tombstone deletes with deletedClock = newClock
5. if command is REPLACE_DOCUMENT: delete old SlotClock rows for room
6. persist SlotClock rows touched by command with clock = newClock
7. if command is REPLACE_DOCUMENT: update Room.roomEpoch = newClock
8. persist ProcessedRequest with payloadHash/result
9. commit
```

Không mutate room memory trước khi DB commit. Flow chuẩn:

```ts
await roomActor.enqueue(command.roomId, async () => {
  const planned = room.planCommand(command); // validate + compute, chưa mutate memory
  const committed = await repository.commit(planned); // DB transaction + stamp clock
  room.applyCommitted(committed.changeSet); // mutate memory sau commit

  transport.enqueueAck(committed.ack);
  transport.enqueueBroadcast(committed.changeSet);
});
```

Nếu DB fail, memory không đổi và client không nhận ACK.

Nếu DB commit thành công nhưng `room.applyCommitted(committed.changeSet)` throw:

```txt
1. mark room unhealthy.
2. stop accepting new commands for that room.
3. do not send ACK for the failed command until room is recovered.
4. reload SyncRoom state from Postgres at latest Room.documentClock.
5. replay/rebuild indexes such as binding reverse index.
6. resume command processing.
```

`applyCommitted` nên là function nhỏ, deterministic và gần như không throw. Nhưng nếu bug xảy ra,
không được tiếp tục xử lý command mới trên memory cũ.

---

## 15. Reconnect / load room

Snapshot:

```ts
interface RoomSnapshot {
  protocolVersion: 2;
  schemaVersion: number;
  roomId: string;
  serverClock: number;
  roomEpoch: number;
  elements: Element[];
  slotClocks: Record<string, Partial<Record<SyncSlot, number>>>;
  processedRequestHistoryStartsAtClock?: number;
}
```

Diff:

```ts
interface RoomDiff {
  protocolVersion: 2;
  schemaVersion: number;
  roomId: string;
  fromClock: number;
  toClock: number;
  serverClock: number;
  roomEpoch: number;
  changed: Element[];
  deleted: { id: string; deletedClock: number }[];
  slotClocks: Record<string, Partial<Record<SyncSlot, number>>>;
  hasMore: boolean;
  nextFromClock?: number;
}

interface ReconnectRequest {
  protocolVersion: 2;
  schemaVersion: number;
  roomId: string;
  lastServerClock: number;
  roomEpoch: number;
  pendingRequestIds: string[];
}

interface PendingRequestStatus {
  requestId: string;
  status: 'processed' | 'unknown' | 'conflict' | 'expired';
  ack?: SyncAck;
}

type ReconnectResponse =
  | {
      kind: 'snapshot';
      snapshot: RoomSnapshot;
      pending: PendingRequestStatus[];
    }
  | {
      kind: 'diff';
      diff: RoomDiff;
      pending: PendingRequestStatus[];
    };
```

Query:

```txt
Run ROOM_DIFF / ROOM_SNAPSHOT in a consistent DB transaction.
Use REPEATABLE READ or equivalent consistent snapshot.

targetClock = Room.documentClock
roomEpoch = Room.roomEpoch

changed = Record
  where roomId = ?
    and recordClock > lastServerClock
    and recordClock <= targetClock

deleted = Tombstone
  where roomId = ?
    and deletedClock > lastServerClock
    and deletedClock <= targetClock

slotClocks = SlotClock
  where roomId = ?
    and clock > lastServerClock
    and clock <= targetClock

serverClock = targetClock
```

Không được query `serverClock` ở một thời điểm rồi query `Record/Tombstone/SlotClock` ở snapshot
khác. Nếu load diff từ hot `SyncRoom` actor thay vì DB, cũng phải serialize với command apply để
diff nhìn thấy state nhất quán tại một clock cụ thể.

Reconnect:

```txt
Client:
  send lastServerClock, roomEpoch, pendingRequestIds

Server:
  if lastServerClock < roomEpoch:
    send ROOM_SNAPSHOT wipe_all at current roomEpoch/serverClock
  else if lastServerClock < tombstoneHistoryStartsAtClock:
    send ROOM_SNAPSHOT wipe_all
  else:
    send ROOM_DIFF changed records/tombstones/slotClocks after clock

Client:
  hydrate/apply server state
  apply pending request statuses:
    processed => clear pending and use ack only if monotonic guard allows applying changeSet
    unknown => resend with same requestId if still relevant
    conflict/expired => drop pending and surface conflict/manual retry
  update known slot clocks
  update lastServerClock only after diff/snapshot is fully applied
  update roomEpoch
  drop pending that are no longer relevant
  resend pending with same requestId only if still valid
```

Không trả `ROOM_DIFF` xuyên qua replace boundary. Nếu client offline trước
`REPLACE_DOCUMENT` rồi reconnect sau replace, `lastServerClock < roomEpoch` phải nhận full
`ROOM_SNAPSHOT wipe_all` tại current `roomEpoch/serverClock`.

Client không resend blindly sau server restart. Sau snapshot/diff, pending phải được kiểm tra lại
theo element existence, slot clock và `roomEpoch`.

Nếu `ProcessedRequest` history bị GC, reconnect response phải nói rõ pending nào còn safe để
resend. Pending quá retention nhận status `expired`, bị drop và báo conflict/manual retry. Phase đầu
có thể không GC `ProcessedRequest` trong thời gian demo/dev.

Diff/snapshot size:

```txt
Nếu ROOM_DIFF vượt MAX_DIFF_BYTES:
  trả ROOM_SNAPSHOT nếu snapshot còn trong limit.

Nếu snapshot cũng vượt limit:
  stream/chunk snapshot theo pages.

Nếu RoomDiff.hasMore = true:
  client tiếp tục request từ nextFromClock cho tới khi đủ serverClock target.
```

---

## 16. Tombstone GC

`tombstoneHistoryStartsAtClock` không được là field treo. Cần GC policy rõ.

Policy phase đầu:

```txt
Giữ tombstone tối thiểu 24h hoặc N clocks gần nhất.
Khi xóa tombstone cũ:
  tombstoneHistoryStartsAtClock = max deletedClock đã bị GC.

Nếu client.lastServerClock < tombstoneHistoryStartsAtClock:
  phải nhận full snapshot.

Nếu client.lastServerClock >= tombstoneHistoryStartsAtClock:
  diff còn an toàn.
```

Nếu chưa implement GC ngay, giữ tombstone vô hạn trong phase đầu và để
`tombstoneHistoryStartsAtClock = 0`. Nhưng schema vẫn nên có field này để không vỡ protocol sau
này.

---

## 17. Atomic commands

Atomic nghĩa là một nhóm thay đổi phải đi cùng nhau: cùng commit hoặc cùng fail.

```ts
type SyncCommand =
  | CreateElementCommand
  | ReorderElementsCommand
  | PatchSlotsCommand
  | UpdateArrowBindingCommand
  | DeleteElementsCommand
  | ReplaceDocumentCommand;
```

Command sinh ra `CommittedChangeSet`. Không module nào được tự ý `map.set` hoặc write DB bypass
`SyncRoom`.

Boundary:

```txt
planCommand:
  authenticate/authorize đã xong trước đó
  validate
  compute PlannedChangeSet
  no memory mutation

commit:
  persist DB transaction
  assign one documentClock
  stamp CommittedChangeSet

applyCommitted:
  mutate SyncRoom memory
  enqueue ack/broadcast
```

### CreateElementCommand

Create là command riêng, không phải patch vào element chưa tồn tại.

```ts
interface CreateElementCommand extends SyncCommandBase {
  kind: 'create_element';
  element: Element;
  afterElementId?: string | null;
  beforeElementId?: string | null;
  baseOrderClock?: number;
}
```

Server flow:

```txt
1. check permission edit room.
2. reject nếu element id đã tồn tại trong active Record.
3. reject nếu element id tồn tại trong Tombstone retention window.
4. validate raw client element.
5. normalize + fill defaults thành canonical full element state.
6. derive/cache server-owned fields.
7. validate asset/group/frame refs nếu có.
8. assign/normalize order:
   - nếu có afterElementId/beforeElementId: server tính final order.
   - nếu không có hint: append top = max(zIndex) + 1.
   - nếu client gửi zIndex duplicate: server có quyền normalize.
9. initialize slot clocks từ canonical normalized element bằng newClock.
10. persist Record với recordClock = newClock.
11. persist SlotClock rows.
12. return CommittedChangeSet reason = create.
```

Element ID không được reuse trong tombstone retention window. Nếu cho reuse ID, client cũ có thể
nhận tombstone cũ và hiểu nhầm là delete element mới.

Concurrent create được order theo server commit order. Slot `order` giữ đường migrate sang
fractional index sau này.

Invariant create:

```txt
raw client element
  -> validate
  -> normalize + materialize defaults
  -> derive fields
  -> compute initial slot clocks
  -> persist
```

Mọi mutable field có default như fillColor/strokeWidth/opacity/font fields phải được materialize
trước khi init `SlotClock`. Không init slot clocks từ raw client payload thiếu default.

### ReorderElementsCommand

Phase đầu không cho client patch trực tiếp slot `order`.

```ts
interface ReorderElementsCommand extends SyncCommandBase {
  kind: 'reorder_elements';
  elementIds: string[];
  afterElementId?: string | null;
  beforeElementId?: string | null;
  baseOrderClock: number;
}
```

Nếu cần reorder, server tự tính final order/fractional index và emit `slotPatches` cho toàn bộ
element bị ảnh hưởng. Nếu chưa implement reorder trong phase đầu, reject `PatchSlotsCommand` vào
slot `order` và chỉ normalize order trong `CreateElementCommand`.

---

## 18. Linear elements: line / arrow / freehand

Rule:

```txt
Rectangle/ellipse/text/image:
  transform.position = x/y
  transform.size = width/height
  transform.rotation = angle

Line/arrow/freehand/highlighter:
  geometry.points = full points value
  geometry.route = arrow route/path nếu có
  geometry.startPoint/endPoint = unbound arrow endpoints
  x/y/width/height là derived cache từ points
  client không được gửi transform.* độc lập cho linear elements
```

Khi move line/arrow/freehand:

```txt
client sends geometry.points translated
server validates points
server normalizes x/y/width/height from points
server commits geometry + derived bbox in one command
```

`normalizeLinearBounds(points)` nên chạy cả client lẫn server. Server là authoritative.

Validation:

- points là array hợp lệ;
- point count <= limit;
- numbers finite;
- freehand có `MAX_POINTS_PER_STROKE`;
- bbox derived không NaN/Infinity;
- `transform.*` patch cho linear element bị reject `INVALID_SLOT_FOR_ELEMENT_TYPE`.

---

## 19. Arrow binding

Binding vẫn theo ID, nhưng ID không đủ. Cần lưu anchor và repair lifecycle.

Bản đơn giản cho project:

```ts
interface ArrowEndpointBinding {
  elementId: string;
  anchorRatio: { x: number; y: number };
}
```

Trong `ElementProps`:

```ts
startBinding?: ArrowEndpointBinding | null;
endBinding?: ArrowEndpointBinding | null;
```

Binding update là command riêng, không phải `SlotPatch` đơn:

```ts
interface UpdateArrowBindingCommand extends SyncCommandBase {
  kind: 'update_arrow_binding';
  arrowId: string;
  terminal: 'start' | 'end';
  binding: ArrowEndpointBinding | null;
  baseBindingClock: number;
  baseGeometryClock: number;
}
```

Server:

```txt
1. validate arrow exists
2. validate target exists nếu binding != null
3. lấy arrow hiện tại trong room memory
4. apply terminal đang đổi vào server-current arrow
5. giữ terminal còn lại theo server state hiện tại
6. recompute full endpoint/path từ current binding state
7. nếu baseGeometryClock stale: accept nhưng ack action = rebase
8. không tin geometry từ client trong binding command
9. produce changeSet:
   puts: [arrow]
   slotPatches:
     binding.start hoặc binding.end
     geometry.route/geometry.startPoint/geometry.endPoint nếu server recompute
   slotClocks:
     binding.start hoặc binding.end = newClock
     geometry.* touched = newClock
10. commit binding + geometry together
```

`binding.start` và `binding.end` vẫn merge được vì server recompute từ arrow hiện tại:

```txt
A update startBinding => server commit binding.start + derived geometry.
B update endBinding trên base geometry cũ => server lấy arrow current có startBinding của A,
apply endBinding của B, recompute full geometry, trả rebase nếu cần.
```

Target transform/geometry repair:

```txt
Nếu PatchSlotsCommand đổi transform.position / transform.size / transform.rotation / geometry.*
của một element đang là binding target:
  tìm arrows bind tới element đó;
  recompute endpoint/path của các arrows đó từ server-current binding state;
  add repaired arrows vào cùng PlannedChangeSet;
  update geometry.* slotClock của repaired arrows cùng serverClock;
  enforce MAX_REPAIRED_ARROWS_PER_COMMAND.
```

Không được commit target transform rồi để bound arrows lệch visual.

Lý do không chỉ set `elementId`:

- target có thể xoay/resize;
- arrow endpoint cần nằm ở edge/anchor đúng;
- elbow/path routing có thể phải recompute `points`;
- nếu target bị delete, arrow cần unbind nhưng giữ vị trí visual gần nhất.

Future/tldraw-like model:

```txt
Binding as separate record:
  id
  type = 'arrow'
  fromId = arrowId
  toId = targetShapeId
  terminal = start | end
  normalizedAnchor
```

Phase đầu có thể giữ binding trong arrow props để giảm scope, nhưng server vẫn phải có binding
lifecycle.

---

## 20. Delete elements

Delete là command riêng:

```ts
interface DeleteElementsCommand extends SyncCommandBase {
  kind: 'delete_elements';
  elementIds: string[];
}
```

Option chốt: hard delete active record + tombstone authoritative.

```txt
Active Record không giữ element deleted.
Delete tạo Tombstone.
Client không được gửi SlotPatch flags.deleted/isDeleted.
Nếu Element còn isDeleted legacy thì renderer có thể hiểu, nhưng sync không dùng field này làm
conflict slot.
```

Server transaction:

```txt
for each deleted id:
  remove active Record
  create/upsert Tombstone

for each arrow:
  if startBinding.elementId in deletedIds:
    clear startBinding
    keep current visual endpoint as concrete point
    normalize arrow geometry

  if endBinding.elementId in deletedIds:
    clear endBinding
    keep current visual endpoint as concrete point
    normalize arrow geometry

commit all with one serverClock
broadcast:
  deletes: deletedIds
  puts: repaired arrows
  slotPatches: full semantic slot patches for repaired arrows
```

Rule:

- delete-wins;
- patch tới deleted element bị reject;
- cùng `requestId` retry delete => replay ack cũ;
- request mới delete element đã tombstoned => reject `ELEMENT_DELETED`, không commit no-op;
- binding tới deleted target bị reject;
- repaired arrows phải là part của cùng committed change set;
- repaired arrows phải có `slotPatches` cho `binding.start`, `binding.end` và/hoặc `geometry.*`
  slots bị đổi, không chỉ nằm trong `puts`;
- tombstone là nguồn diff cho reconnect.

---

## 21. Import / restore / replace document

Phase đầu chọn **replace**, không merge.

```ts
interface ReplaceDocumentCommand extends SyncCommandBase {
  kind: 'replace_document';
  elements: Element[];
  reason: 'import' | 'restore' | 'manual_replace';
}
```

Server:

```txt
1. check permission editor/owner
2. validate native file/schema
3. normalize all elements
4. compute current active ids not in new file => delete/tombstone
5. upsert new file elements
6. delete old SlotClock rows for the room
7. rebuild slot clocks from scratch for all incoming elements
8. increment documentClock once
9. set roomEpoch = new documentClock
10. commit DB transaction
11. update SyncRoom memory
12. broadcast ROOM_REPLACED
```

Replace document phải rebuild slot clocks từ scratch. Nếu chỉ upsert slotClock mới, element cùng id
nhưng đổi type/schema có thể giữ lại stale slot clock cũ như `text.content` trên rectangle mới.

Payload:

```ts
interface RoomReplacedPayload {
  roomId: string;
  serverClock: number;
  roomEpoch: number;
  elements: Element[];
  slotClocks: Record<string, Partial<Record<SyncSlot, number>>>;
}
```

Client:

```txt
clear pending queue
setElements(elements)
setKnownSlotClocks(slotClocks)
lastServerClock = serverClock
roomEpoch = payload.roomEpoch
ignore ack for requests no longer in pending queue
```

Mọi command có `baseRoomEpoch`. Server reject command nếu `baseRoomEpoch !== roomEpoch`:

```txt
reason = STALE_ROOM_EPOCH
```

Import/restore không được ghi thẳng DB bypass `SyncRoom`.

### Asset lifecycle

Asset binary upload/storage nằm ngoài sync core phase đầu. Sync core chỉ sync asset reference đã hợp
lệ.

Rule:

```txt
asset upload hoàn tất trước khi create/update element dùng asset.src.
Server reject asset.src nếu asset không tồn tại hoặc actor không có quyền dùng asset đó.
Replace document chỉ replace element references; asset GC/ref-count là concern riêng.
Reconnect trả element refs; client asset loader xử lý fetch/cache binary.
```

### Group/frame invariants

Nếu app dùng group/frame, server validation phải bảo vệ reference graph:

```txt
Không cho groupId/frameId trỏ tới missing/deleted record.
Không tạo cycle group/frame.
Delete group/frame không tự delete children trong phase đầu.
Khi delete group/frame, server clear grouping.groupId/frameId của children trong cùng changeSet,
hoặc reject nếu rule product chọn "không cho delete group/frame còn children".
```

---

## 22. Undo / redo

Không làm multiplayer-aware undo đầy đủ. Làm local-user undo có điều kiện.

```ts
interface UndoEntry {
  elementId: string;
  slot: SyncSlot;
  inverseChanges: Record<string, unknown>;

  // slotClock sau khi patch gốc của user commit
  afterSlotClock: number;
}
```

Undo:

```ts
function undo(entry: UndoEntry) {
  const currentClock = getKnownSlotClock(entry.elementId, entry.slot);

  if (currentClock !== entry.afterSlotClock) {
    showConflictMessage('Cannot undo safely because this part changed after your edit.');
    return;
  }

  sendPatch({
    requestId: uuidv4(),
    clientClock: nextClientClock(),
    baseRoomEpoch: getRoomEpoch(),
    elementId: entry.elementId,
    slot: entry.slot,
    baseClock: currentClock,
    changes: entry.inverseChanges,
  });
}
```

Rule:

- undo chỉ undo thao tác của chính user;
- undo chỉ apply nếu slot chưa đổi kể từ thao tác gốc;
- nếu slot đã đổi, báo conflict và không undo tự động.
- phase đầu chỉ hỗ trợ undo cho single-slot `PatchSlotsCommand`;
- multi-slot commands như create/delete/binding/replace chưa có multiplayer-aware undo, hoặc cần
  command undo chuyên biệt sau này.

---

## 23. Presence

Presence/cursor/selection không đi qua `SlotPatch`.

```ts
interface PresenceUpdate {
  roomId: string;
  actorId: string;
  cursor: { x: number; y: number } | null;
  selectedIds: string[];
  viewport?: { x: number; y: number; zoom: number };
}
```

Rule:

- presence ephemeral;
- không persist vào document;
- không tăng `documentClock`;
- có thể throttle 33ms cursor, 50-200ms selection/viewport;
- Redis có thể hữu ích cho presence nếu scale ngang, nhưng phase đầu chưa cần.

---

## 24. Module boundary

Shared:

```txt
packages/shared/src/sync/
  slots.ts
  protocol.ts
  validation.ts
```

Backend:

```txt
backend/src/sync/
  sync-room.ts
  room-actor.ts
  apply-command.ts
  slot-validation.ts
  binding-repair.ts
  linear-normalization.ts
  persistence/
    sync-repository.ts
    room-diff.ts
    transaction.ts
```

Frontend:

```txt
frontend/src/sync/
  client/
    socket-transport.ts
    pending-queue.ts
    ack-handlers.ts
    reconnect.ts
    reconciliation.ts
  patches/
    diff-elements.ts
    field-to-slot.ts
    materialize-change-set.ts
```

Rule kiến trúc:

- UI/tools chỉ gọi local mutation command.
- Sync client tạo `SlotPatch`/`SyncCommand`.
- Server `SyncRoom` là nơi duy nhất merge/conflict.
- Mọi command chạy qua per-room serialized executor/room actor.
- Persistence chỉ bị gọi từ `SyncRoom`/repository.
- Import/restore/delete/binding repair đều là `SyncCommand`.

---

## 25. Acceptance criteria

- [ ] Không còn gửi whole `Element[]` cho mutation nhỏ như đổi màu/kéo shape.
- [ ] `PatchSlotsCommand` dùng command-level `requestId`, không dùng `batchId` + patch-level ack.
- [ ] Một patch invalid trong `PatchSlotsCommand` reject cả command; stale base cùng slot thì LWW.
- [ ] Mọi command trong cùng room serialize trọn `plan -> commit -> apply`.
- [ ] Server không tin `actorId` từ payload; actor lấy từ authenticated socket/session.
- [ ] Permission edit room được check cho create/patch/binding/delete/replace.
- [ ] Server reject command sai `protocolVersion` bằng `UNSUPPORTED_PROTOCOL_VERSION`.
- [ ] Server reject command sai `schemaVersion` bằng `UNSUPPORTED_SCHEMA_VERSION`.
- [ ] A kéo shape, B đổi fillColor cùng lúc => merge `transform.position` + fillColor.
- [ ] A đổi fillColor, B đổi strokeWidth cùng lúc => merge cả hai vì khác slot.
- [ ] A kéo shape, B resize cùng shape => merge `transform.position` + `transform.size`.
- [ ] A kéo shape, B cũng kéo cùng shape => cùng slot `transform.position`, latest-to-server wins.
- [ ] A resize shape, B cũng resize cùng shape => cùng slot `transform.size`, latest-to-server wins.
- [ ] A sửa text, B đổi màu => merge text + style.
- [ ] Binding update commit binding + server-derived geometry cùng một `documentClock`.
- [ ] A sửa startBinding, B sửa endBinding => merge bằng cách server recompute geometry từ current arrow state.
- [ ] Move/resize/rotate target shape repair bound arrows trong cùng committed change set.
- [ ] Mọi repaired arrow emit `slotPatches` đầy đủ cho slots bị đổi, không chỉ nằm trong `puts`.
- [ ] Create element reject duplicate active id và tombstone id trong retention window.
- [ ] Create element normalize + materialize defaults trước khi init SlotClock.
- [ ] Create element server normalize order/zIndex và trả final order trong changeSet.
- [ ] Client không patch trực tiếp slot `order`; create/reorder phải qua command domain.
- [ ] Command phụ thuộc slot đọc thêm khai báo `readPreconditions` hoặc server recompute.
- [ ] Patch gửi với `baseClock` cũ cùng slot => server accept latest-to-server và trả rebase/changeSet nếu cần.
- [ ] Slot chưa từng set dùng `baseClock = 0`, không dùng `null` trong protocol.
- [ ] Patch khác slot dù `baseClock` cũ vẫn merge được.
- [ ] Invalid slot/field/value bị reject và clear pending.
- [ ] Derived/local-only fields như cache/bounds/selection/versionNonce bị reject `INVALID_FIELD`.
- [ ] Commands vượt patch/delete/changeset limit bị reject `TOO_LARGE`.
- [ ] Linear element nhận `transform.*` patch bị reject `INVALID_SLOT_FOR_ELEMENT_TYPE`.
- [ ] Patch không chứa full semantic slot value bị reject `INVALID_FIELD`.
- [ ] Client apply server changeSet slot-aware, không replace whole element cho mutation nhỏ.
- [ ] Client giữ `serverState` và `optimisticState`, reconcile bằng cách replay pending còn lại.
- [ ] Client detect gap `serverClock` và fetch `ROOM_DIFF` trước khi resume realtime apply.
- [ ] Client clear pending khi ACK/broadcast chứa `originRequestIds` của chính mình.
- [ ] Reconnect gửi `pendingRequestIds`; server trả processed/unknown/conflict/expired statuses.
- [ ] ROOM_DIFF không cần `originRequestIds`; client apply diff slot-aware từ `changed + slotClocks`.
- [ ] Reject không rollback nếu slot đã có pending mới hơn.
- [ ] Duplicate requestId cùng payloadHash không mutate state lần hai và không broadcast duplicate, kể cả sau server restart.
- [ ] Duplicate requestId khác payloadHash bị reject `DUPLICATE_REQUEST_CONFLICT`.
- [ ] Idempotency check chạy trước validation duplicate element/delete.
- [ ] Reconnect hydrate snapshot/diff, validate pending, resend cùng requestId chỉ khi relevant.
- [ ] ROOM_DIFF/ROOM_SNAPSHOT là consistent read tại một `targetClock`.
- [ ] Reconnect với `lastServerClock < roomEpoch` trả `ROOM_SNAPSHOT wipe_all`, không trả diff xuyên replace boundary.
- [ ] Client update `lastServerClock` chỉ sau khi apply đầy đủ snapshot/diff/changeSet.
- [ ] Server chỉ ACK sau khi DB transaction thành công.
- [ ] Server restart load được state đã ACK commit.
- [ ] Nếu `applyCommitted` fail sau DB commit, room bị mark unhealthy và reload từ Postgres trước khi nhận command mới.
- [ ] Delete element clear/repair binding liên quan trong cùng committed change set.
- [ ] Delete chỉ qua `DeleteElementsCommand`, không qua `SlotPatch(isDeleted)`.
- [ ] Binding tới deleted/missing target bị reject.
- [ ] Linear elements sync `geometry.points`; bbox được normalize server-side.
- [ ] Bound arrow endpoint không được patch trực tiếp bằng geometry; phải dùng binding command hoặc clear binding.
- [ ] Import/restore replace document atomic và broadcast `ROOM_REPLACED`.
- [ ] Replace document xóa old SlotClock rows rồi rebuild slot clocks từ scratch.
- [ ] Pending queue bị clear khi nhận `ROOM_REPLACED`.
- [ ] Mọi command có `baseRoomEpoch`; pending cũ sau replace bị reject `STALE_ROOM_EPOCH`.
- [ ] Command có `baseRoomEpoch !== roomEpoch` bị reject `STALE_ROOM_EPOCH`.
- [ ] Ack cũ sau `ROOM_REPLACED` bị ignore nếu request không còn pending.
- [ ] Drag sync có max in-flight/backpressure và luôn gửi final pointerup patch.
- [ ] Undo chỉ chạy nếu current slotClock bằng afterSlotClock của undo entry.
- [ ] Undo phase đầu chỉ cover single-slot patch.
- [ ] Pending create rồi patch/delete giữ dependency order hoặc squash/cancel đúng.
- [ ] Asset binary upload/storage nằm ngoài sync core; sync chỉ nhận asset reference hợp lệ.
- [ ] Group/frame refs missing/deleted/cycle bị reject hoặc repaired theo rule server.
- [ ] Presence không tăng document clock và không persist vào document.

---

## 26. Migration notes cho SPECS.md

Những phần cần thay trong `docs/SPECS.md`:

- `Conflict resolution = version/versionNonce` -> `slot-level LWW + documentClock`.
- `Sync data only Element[]` -> `sync commands / semantic slot patches / committed change sets`.
- Transform cũ phải tách thành `transform.position`, `transform.size`, `transform.rotation`.
- `version++/versionNonce` không còn là conflict source chính. Có thể giữ legacy fields nếu cần
  backward compatibility, nhưng sync không dựa vào chúng.
- P1B BroadcastChannel whole-element sync là deprecated/local-only legacy.
- P2 Realtime MVP không gửi `ELEMENT_UPDATE: Element[]`; thay bằng `SyncCommand`.
- P3A reconnect diff dựa trên `documentClock`, `Record.recordClock`, `Tombstone.deletedClock`,
  `SlotClock.clock`.
- P4 native import phải đi qua `ReplaceDocumentCommand`, không ghi DB trực tiếp.
- P5 không còn là "future field-level CRDT"; sync refactor trở thành core architecture.
- Postgres là durable source of truth. Redis chỉ là optional scale layer, không phải source of
  truth. Không thêm MongoDB cho sync core.
- Frontend sync phải chuyển sang `serverState + optimisticState + replay pending`, không apply
  remote element whole-object cho mutation nhỏ.
- Backend sync phải có per-room serialized executor trước khi implement DB commit/ACK.

---

## 27. Non-goals

- Không làm multi-master CRDT.
- Không làm character-level collaborative text.
- Không làm per-point merge cho freehand.
- Không làm WAL/SyncOperation bắt buộc trong phase đầu.
- Không làm merge import file trong phase đầu, chỉ replace.
- Không làm Redis shared state trong phase đầu.
- Không thêm MongoDB cho sync core.
- Không làm full Figma undo semantics.
- Không làm asset binary upload/storage/ref-count/GC trong sync core phase đầu.
- Không làm multiplayer-aware undo cho create/delete/binding/replace trong phase đầu.
