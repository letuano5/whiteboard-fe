import type { Camera, Element, ElementProps, ElementType } from './index';

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
