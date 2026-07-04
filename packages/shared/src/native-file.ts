import { MAX_ZOOM, MIN_ZOOM, type Camera } from './camera';
import type { Element, ElementProps, ElementType } from './index';

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

export interface NativeFileSkippedObject {
  index: number;
  reason: string;
}

export interface NativeFileImportReport {
  importedCount: number;
  skippedCount: number;
  skipped: NativeFileSkippedObject[];
}

export type NativeFileNormalizationResult =
  | { ok: true; document: NativeFileDocument; report: NativeFileImportReport }
  | { ok: false; error: string; report: NativeFileImportReport };

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
  const envelopeError = getNativeFileEnvelopeValidationError(value);
  if (envelopeError) return envelopeError;
  if (!isRecord(value)) return 'Native file must be a JSON object.';
  if (!Array.isArray(value.elements) || !value.elements.every(isElement)) {
    return 'Native file elements are invalid.';
  }
  return null;
}

export function isNativeFileDocument(value: unknown): value is NativeFileDocument {
  return getNativeFileValidationError(value) === null;
}

export function normalizeNativeFileDocument(value: unknown): NativeFileNormalizationResult {
  const emptyReport = makeNativeFileReport([]);
  const envelopeError = getNativeFileEnvelopeValidationError(value);
  if (envelopeError || !isRecord(value)) {
    return {
      ok: false,
      error: envelopeError ?? 'Native file must be a JSON object.',
      report: emptyReport,
    };
  }

  const elements: Element[] = [];
  const skipped: NativeFileSkippedObject[] = [];
  const rawElements = value.elements as unknown[];
  rawElements.forEach((element, index) => {
    const reason = getElementValidationError(element);
    if (reason) {
      skipped.push({ index, reason });
      return;
    }
    elements.push(element as Element);
  });

  return {
    ok: true,
    document: {
      kind: NATIVE_FILE_KIND,
      schemaVersion: NATIVE_FILE_SCHEMA_VERSION,
      room: value.room as NativeFileRoomMetadata,
      camera: value.camera as Camera,
      elements,
      assets: value.assets as NativeFileAssetMetadata[] | undefined,
    },
    report: makeNativeFileReport(skipped, elements.length),
  };
}

function makeNativeFileReport(
  skipped: NativeFileSkippedObject[],
  importedCount = 0,
): NativeFileImportReport {
  return {
    importedCount,
    skippedCount: skipped.length,
    skipped,
  };
}

function getNativeFileEnvelopeValidationError(value: unknown): string | null {
  if (!isRecord(value)) return 'Native file must be a JSON object.';
  if (value.kind !== NATIVE_FILE_KIND) return 'Native file kind is not supported.';
  if (value.schemaVersion !== NATIVE_FILE_SCHEMA_VERSION) {
    return 'Native file schema version is not supported.';
  }
  if (!isNativeFileRoomMetadata(value.room)) return 'Native file room metadata is invalid.';
  if (!isCamera(value.camera)) return 'Native file camera is invalid.';
  if (!Array.isArray(value.elements)) return 'Native file elements are invalid.';
  if (
    value.assets !== undefined &&
    (!Array.isArray(value.assets) || !value.assets.every(isAsset))
  ) {
    return 'Native file asset metadata is invalid.';
  }
  return null;
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
  return (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.zoom) &&
    (value.zoom as number) >= MIN_ZOOM &&
    (value.zoom as number) <= MAX_ZOOM
  );
}

function isElement(value: unknown): value is Element {
  return getElementValidationError(value) === null;
}

function getElementValidationError(value: unknown): string | null {
  if (!isRecord(value) || typeof value.type !== 'string') return 'Element type is invalid.';
  if (typeof value.id !== 'string') return 'Element id is invalid.';
  if (!ELEMENT_TYPES.has(value.type as ElementType)) {
    return `Element type "${value.type}" is unsupported.`;
  }
  if (!isFiniteNumber(value.x)) return 'Element x is invalid.';
  if (!isFiniteNumber(value.y)) return 'Element y is invalid.';
  if (!isFiniteNumber(value.width)) return 'Element width is invalid.';
  if (!isFiniteNumber(value.height)) return 'Element height is invalid.';
  if (!isFiniteNumber(value.angle)) return 'Element angle is invalid.';
  if (!isFiniteNumber(value.zIndex)) return 'Element zIndex is invalid.';
  if (!isElementProps(value.props)) return 'Element props are invalid.';
  if (!isFiniteNumber(value.version)) return 'Element version is invalid.';
  if (!isFiniteNumber(value.versionNonce)) return 'Element versionNonce is invalid.';
  if (!isFiniteNumber(value.updatedAt)) return 'Element updatedAt is invalid.';
  if (typeof value.isDeleted !== 'boolean') return 'Element isDeleted is invalid.';
  if (typeof value.groupId !== 'string' && value.groupId !== null) {
    return 'Element groupId is invalid.';
  }
  if (typeof value.frameId !== 'string' && value.frameId !== null) {
    return 'Element frameId is invalid.';
  }
  if (typeof value.locked !== 'boolean') return 'Element locked is invalid.';
  if (typeof value.createdBy !== 'string') return 'Element createdBy is invalid.';
  return null;
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
