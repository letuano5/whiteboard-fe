// ─── Element model (§2.1) ────────────────────────────────────────────────────

export type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'text' // P1A
  | 'diamond'
  | 'triangle'
  | 'polygon' // P1B
  | 'arrow' // P2
  | 'image' // P2.5 — renders via SVG <image> / DOM <img>
  | 'freehand'
  | 'highlighter' // P3C — Canvas overlay
  | 'frame'
  | 'sticky'
  | 'embed'; // P4

export interface ElementProps {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  opacity: number;
  roughness?: number; // P4-10
  points?: [number, number][]; // line, arrow, freehand, highlighter
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  src?: string; // image
  startBinding?: string | null; // arrow
  endBinding?: string | null; // arrow
  url?: string; // embed
}

export interface Element {
  id: string;
  type: ElementType;
  x: number;
  y: number; // world coords, top-left of bounding box
  width: number;
  height: number;
  angle: number; // radians (P1A: always 0; P1B: general)
  zIndex: number; // integer for now
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

// ─── Camera (§2.2) ───────────────────────────────────────────────────────────

export interface Camera {
  x: number;
  y: number;
  zoom: number; // clamped [0.1, 8]
}

// ─── Presence (§2.4) — ephemeral, from P2 ────────────────────────────────────

export interface Presence {
  sessionId: string;
  userId?: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null; // world coords
  selectedIds: string[];
  status: 'active' | 'idle' | 'away';
  viewport?: { x: number; y: number; zoom: number };
  baseRole?: EffectiveRoomRole;
  effectiveRole?: EffectiveRoomRole;
}

// ─── Room access (§P3B-02) ──────────────────────────────────────────────────

export type RoomRole = 'owner' | 'editor' | 'viewer';
export type EffectiveRoomRole = RoomRole | 'none';
export type RoomAccessMode = 'private' | 'link_view' | 'link_edit';

export const ROOM_CAPACITY_LIMITS = {
  MAX_PARTICIPANTS: 50,
  MAX_EDITORS: 10,
} as const;

export interface RoomMemberSummary {
  userId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: RoomRole;
}

export interface RoomInvitationSummary {
  id: string;
  email: string;
  role: Extract<RoomRole, 'editor' | 'viewer'>;
  status: 'pending';
}

export interface RoomAccessPayload {
  roomId: string;
  role: RoomRole;
  baseRole: EffectiveRoomRole;
  effectiveRole: EffectiveRoomRole;
  visibility: RoomAccessMode;
  maxParticipants: number | null;
  maxEditors: number | null;
  shareRevokedAt: string | null;
  members: RoomMemberSummary[];
  invitations: RoomInvitationSummary[];
}

export interface RoomRoleUpdatePayload {
  roomId: string;
  userId: string;
  role: Extract<RoomRole, 'editor' | 'viewer'>;
}

export interface RoomAccessErrorPayload {
  code:
    | 'room-access/unauthenticated'
    | 'room-access/forbidden'
    | 'room-access/user-not-found'
    | 'room-access/member-not-found'
    | 'room-access/invitation-not-found'
    | 'room-access/invalid-role'
    | 'room-access/invalid-capacity'
    | 'room-access/room-full';
  message: string;
}

// ─── Native file lifecycle (§P4-04) ─────────────────────────────────────────

export const NATIVE_FILE_KIND = 'vdt.whiteboard.native';
export const NATIVE_FILE_SCHEMA_VERSION = 1;

export type NativeFileSource = 'local' | 'saved';
export type NativeFileImportMode = 'replace' | 'merge';

export interface NativeFileRoomMetadata {
  id: string | null;
  name: string | null;
  source: NativeFileSource;
  exportedAt: string;
}

export interface NativeFileAssetMetadata {
  id: string;
  name?: string;
  src?: string;
  mimeType?: string;
  byteSize?: number;
}

export interface NativeFileDocument {
  kind: typeof NATIVE_FILE_KIND;
  schemaVersion: typeof NATIVE_FILE_SCHEMA_VERSION;
  room: NativeFileRoomMetadata;
  camera: Camera;
  elements: Element[];
  assets?: NativeFileAssetMetadata[];
}

const ELEMENT_TYPES = new Set<ElementType>([
  'rectangle',
  'ellipse',
  'line',
  'text',
  'diamond',
  'triangle',
  'polygon',
  'arrow',
  'image',
  'freehand',
  'highlighter',
  'frame',
  'sticky',
  'embed',
]);

export function getNativeFileValidationError(value: unknown): string | null {
  if (!isRecord(value)) return 'Native file must be a JSON object.';
  if (value.kind !== NATIVE_FILE_KIND) return 'Native file kind is not supported.';
  if (value.schemaVersion !== NATIVE_FILE_SCHEMA_VERSION) {
    return 'Native file schema version is not supported.';
  }
  if (!isNativeFileRoomMetadata(value.room)) return 'Native file room metadata is invalid.';
  if (!isCamera(value.camera)) return 'Native file camera is invalid.';
  if (!Array.isArray(value.elements) || !value.elements.every(isElement)) {
    return 'Native file elements are invalid.';
  }
  if (
    value.assets !== undefined &&
    (!Array.isArray(value.assets) || !value.assets.every(isAsset))
  ) {
    return 'Native file asset metadata is invalid.';
  }
  return null;
}

export function isNativeFileDocument(value: unknown): value is NativeFileDocument {
  return getNativeFileValidationError(value) === null;
}

function isNativeFileRoomMetadata(value: unknown): value is NativeFileRoomMetadata {
  if (!isRecord(value)) return false;
  return (
    (typeof value.id === 'string' || value.id === null) &&
    (typeof value.name === 'string' || value.name === null) &&
    (value.source === 'local' || value.source === 'saved') &&
    typeof value.exportedAt === 'string'
  );
}

function isCamera(value: unknown): value is Camera {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.zoom);
}

function isElement(value: unknown): value is Element {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  return (
    typeof value.id === 'string' &&
    ELEMENT_TYPES.has(value.type as ElementType) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.angle) &&
    isFiniteNumber(value.zIndex) &&
    isElementProps(value.props) &&
    isFiniteNumber(value.version) &&
    isFiniteNumber(value.versionNonce) &&
    isFiniteNumber(value.updatedAt) &&
    typeof value.isDeleted === 'boolean' &&
    (typeof value.groupId === 'string' || value.groupId === null) &&
    (typeof value.frameId === 'string' || value.frameId === null) &&
    typeof value.locked === 'boolean' &&
    typeof value.createdBy === 'string'
  );
}

function isElementProps(value: unknown): value is ElementProps {
  if (!isRecord(value)) return false;
  if (
    typeof value.strokeColor !== 'string' ||
    typeof value.fillColor !== 'string' ||
    !isFiniteNumber(value.strokeWidth) ||
    (value.strokeStyle !== 'solid' &&
      value.strokeStyle !== 'dashed' &&
      value.strokeStyle !== 'dotted') ||
    !isFiniteNumber(value.opacity)
  ) {
    return false;
  }
  return value.points === undefined || isPointList(value.points);
}

function isPointList(value: unknown): value is [number, number][] {
  return (
    Array.isArray(value) &&
    value.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        isFiniteNumber(point[0]) &&
        isFiniteNumber(point[1]),
    )
  );
}

function isAsset(value: unknown): value is NativeFileAssetMetadata {
  if (!isRecord(value) || typeof value.id !== 'string') return false;
  return (
    (value.name === undefined || typeof value.name === 'string') &&
    (value.src === undefined || typeof value.src === 'string') &&
    (value.mimeType === undefined || typeof value.mimeType === 'string') &&
    (value.byteSize === undefined || isFiniteNumber(value.byteSize))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// ─── WebSocket event constants ────────────────────────────────────────────────

export const WS_EVENTS = {
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  ELEMENT_CREATE: 'element-create',
  ELEMENT_UPDATE: 'element-update',
  ELEMENT_DELETE: 'element-delete',
  ELEMENT_DRAFT: 'element-draft',
  CURSOR_MOVE: 'cursor-move',
  USER_JOIN: 'user-join',
  USER_LEAVE: 'user-leave',
  ROOM_DIFF: 'room-diff', // AC-12: distinct WS event for reconnect incremental diff (P3A-03)
  ROOM_SNAPSHOT: 'room-snapshot',
  ROOM_RESYNC: 'room-resync',
  ROOM_ACCESS: 'room-access',
  ROOM_ROLE_UPDATE: 'room-role-update',
  ROOM_ACCESS_ERROR: 'room-access-error',
} as const;

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
