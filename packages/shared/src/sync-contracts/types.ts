import type { ArrowEndpointBinding, Element } from '../index';

export const SYNC_PROTOCOL_VERSION = 1;
export const SYNC_SCHEMA_VERSION = 1;

export type SyncClock = number;

export type SyncSlot =
  | 'transform.position'
  | 'transform.size'
  | 'transform.rotation'
  | 'style.strokeColor'
  | 'style.fillColor'
  | 'style.strokeWidth'
  | 'style.strokeStyle'
  | 'style.opacity'
  | 'style.roughness'
  | 'text.text'
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
  | 'grouping.frameId'
  | 'state.locked';

export type PointTuple = [number, number];

export interface SyncSlotValueMap {
  'transform.position': { x: number; y: number };
  'transform.size': { width: number; height: number };
  'transform.rotation': { angle: number };
  'style.strokeColor': { strokeColor: string };
  'style.fillColor': { fillColor: string };
  'style.strokeWidth': { strokeWidth: number };
  'style.strokeStyle': { strokeStyle: Element['props']['strokeStyle'] };
  'style.opacity': { opacity: number };
  'style.roughness': { roughness: number | null };
  'text.text': { text: string | null };
  'text.fontSize': { fontSize: number | null };
  'text.fontFamily': { fontFamily: string | null };
  'text.textAlign': { textAlign: Element['props']['textAlign'] | null };
  'geometry.points': { points: PointTuple[] };
  'geometry.route': { route: PointTuple[] | null };
  'geometry.startPoint': { startPoint: PointTuple | null };
  'geometry.endPoint': { endPoint: PointTuple | null };
  'binding.start': { binding: ArrowEndpointBinding | null };
  'binding.end': { binding: ArrowEndpointBinding | null };
  order: { zIndex: number };
  'asset.src': { src: string | null };
  'embed.url': { url: string | null };
  'grouping.groupId': { groupId: string | null };
  'grouping.frameId': { frameId: string | null };
  'state.locked': { locked: boolean };
}

export type SlotValue<S extends SyncSlot = SyncSlot> = SyncSlotValueMap[S];

export interface SlotPatch<S extends SyncSlot = SyncSlot> {
  elementId: string;
  slot: S;
  baseClock: SyncClock;
  changes: SlotValue<S>;
  inverseChanges?: SlotValue<S>;
}

export interface SyncReadPrecondition {
  elementId: string;
  slot: SyncSlot;
  baseClock: SyncClock;
  onStale: 'reject' | 'rebase' | 'server_recompute';
}

export interface SyncCommandPersistenceHints {
  /**
   * Marks an intermediate local interaction patch that is intentionally not resendable.
   * Only valid for patch-slot drag/interaction updates that will be superseded by a final patch.
   */
  transient?: boolean;
  /**
   * Defaults to true. Resendable commands must persist a ProcessedRequest entry.
   */
  resendable?: boolean;
  /**
   * Defaults to true for resendable commands. May be false only when `resendable` is false.
   */
  storeProcessedRequest?: boolean;
  /**
   * Relaxed durability maps to PostgreSQL `synchronous_commit = off`; it is not durable.
   */
  durability?: 'durable' | 'relaxed';
}

interface SyncCommandEnvelope {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  roomId: string;
  requestId: string;
  clientClock: SyncClock;
  baseRoomEpoch: SyncClock;
  readPreconditions?: SyncReadPrecondition[];
  persistence?: SyncCommandPersistenceHints;
}

export interface SyncOrderHint {
  afterElementId?: string;
  beforeElementId?: string;
  baseOrderClock?: SyncClock;
}

export interface CreateElementCommand extends SyncCommandEnvelope {
  kind: 'create-element';
  element: Element;
  orderHint?: SyncOrderHint;
}

export interface PatchSlotsCommand extends SyncCommandEnvelope {
  kind: 'patch-slots';
  patches: SlotPatch[];
}

export interface ReorderElementMove {
  elementId: string;
  afterElementId?: string;
  beforeElementId?: string;
  baseOrderClock?: SyncClock;
}

export interface ReorderElementsCommand extends SyncCommandEnvelope {
  kind: 'reorder-elements';
  moves: ReorderElementMove[];
}

export interface UpdateArrowBindingCommand extends SyncCommandEnvelope {
  kind: 'update-arrow-binding';
  arrowId: string;
  terminal: 'start' | 'end';
  binding: ArrowEndpointBinding | null;
  baseBindingClock: SyncClock;
  baseGeometryClock: SyncClock;
}

export interface DeleteElementsCommand extends SyncCommandEnvelope {
  kind: 'delete-elements';
  elementIds: string[];
}

export interface ReplaceDocumentCommand extends SyncCommandEnvelope {
  kind: 'replace-document';
  elements: Element[];
  reason: 'import' | 'restore' | 'manual_replace';
}

export type SyncCommand =
  | CreateElementCommand
  | PatchSlotsCommand
  | ReorderElementsCommand
  | UpdateArrowBindingCommand
  | DeleteElementsCommand
  | ReplaceDocumentCommand;

export interface SyncOrderEntry {
  elementId: string;
  zIndex: number;
}

export interface SlotClockUpdate {
  elementId: string;
  slot: SyncSlot;
  clock: SyncClock;
}

export type PendingRequestState = 'processed' | 'unknown' | 'conflict' | 'expired';

export interface PendingRequestStatus {
  requestId: string;
  status: PendingRequestState;
  serverClock?: SyncClock;
  reason?: string;
}

export interface RoomSnapshot {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  roomId: string;
  serverClock: SyncClock;
  roomEpoch: SyncClock;
  elements: Element[];
  slotClocks: SlotClockUpdate[];
  processedRequestHistoryStartsAtClock?: SyncClock;
  wipeAll?: boolean;
  pendingRequests?: PendingRequestStatus[];
}

export interface RoomDiff {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  roomId: string;
  fromClock: SyncClock;
  toClock: SyncClock;
  serverClock: SyncClock;
  roomEpoch: SyncClock;
  changed: Element[];
  deleted: Array<{ id: string }>;
  slotClocks: SlotClockUpdate[];
  hasMore: boolean;
  nextFromClock?: SyncClock;
  pendingRequests?: PendingRequestStatus[];
}

export interface RoomReplacedPayload {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  roomId: string;
  serverClock: SyncClock;
  roomEpoch: SyncClock;
  elements: Element[];
  slotClocks: SlotClockUpdate[];
}

export interface ReconnectRequest {
  roomId: string;
  lastServerClock: SyncClock;
  roomEpoch: SyncClock;
  pendingRequestIds: string[];
}

export type ReconnectResponse =
  | { kind: 'snapshot'; snapshot: RoomSnapshot; pendingRequests: PendingRequestStatus[] }
  | { kind: 'diff'; diff: RoomDiff; pendingRequests: PendingRequestStatus[] };

export type ChangeSetReason =
  | 'create'
  | 'patch_clean'
  | 'patch_lww_conflict'
  | 'binding_update'
  | 'delete'
  | 'replace_document'
  | 'repair';

export type CommittedSlotPatch<S extends SyncSlot = SyncSlot> = SlotPatch<S> & {
  clock: SyncClock;
};

export interface CommittedChangeSet {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  roomId: string;
  requestId: string;
  serverClock: SyncClock;
  roomEpoch: SyncClock;
  originActorId: string | null;
  originRequestIds: string[];
  reason: ChangeSetReason;
  slotPatches: CommittedSlotPatch[];
  puts: Element[];
  deletes: string[];
  created: Element[];
  patched: Array<{ elementId: string; patches: SlotPatch[]; element: Element }>;
  deleted: string[];
  slotClocks: SlotClockUpdate[];
  normalizedOrder: SyncOrderEntry[];
}

export type SyncAckStatus = 'commit' | 'rebase' | 'reject';

interface SyncAckBase {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  roomId: string;
  requestId: string;
  serverClock: SyncClock;
}

export interface SyncCommitAck extends SyncAckBase {
  status: 'commit';
  changeSet: CommittedChangeSet;
}

export interface SyncRebaseAck extends SyncAckBase {
  status: 'rebase';
  changeSet: CommittedChangeSet;
}

export interface SyncRejectAck extends SyncAckBase {
  status: 'reject';
  reason: string;
  serverChangeSet?: CommittedChangeSet;
}

export type SyncAck = SyncCommitAck | SyncRebaseAck | SyncRejectAck;

export interface SyncBroadcast {
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  schemaVersion: typeof SYNC_SCHEMA_VERSION;
  roomId: string;
  serverClock: SyncClock;
  changeSet: CommittedChangeSet;
}

export interface SyncValidationContext {
  activeElementIds?: ReadonlySet<string>;
  tombstoneElementIds?: ReadonlySet<string>;
  currentSlotClocks?: ReadonlyMap<string, SyncClock>;
}

export type CreateValidationContext = SyncValidationContext;

export interface MaterializeCreateOptions {
  zIndex?: number;
  updatedAt?: number;
}

export type SyncValidationResult = { ok: true } | { ok: false; errors: string[] };
