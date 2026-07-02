import { describe, expect, it } from 'vitest';
import type { Camera, Element } from '../../types/shared';
import {
  buildNativeFileDocument,
  createNativeFileName,
  parseNativeFileTextWithReport,
  parseNativeFileText,
  serializeNativeFile,
} from '../native-file';

const camera: Camera = { x: 12, y: 34, zoom: 1.5 };

describe('native file helpers', () => {
  it('round-trips existing element metadata through the native schema', () => {
    // @covers AC-1
    // @covers AC-3
    const elements: Element[] = [
      makeElement({
        id: 'arrow-1',
        type: 'arrow',
        angle: 0.35,
        zIndex: 42,
        groupId: 'group-1',
        frameId: 'frame-1',
        locked: true,
        props: {
          strokeColor: '#123456',
          fillColor: 'transparent',
          strokeWidth: 3,
          strokeStyle: 'dashed',
          opacity: 0.8,
          points: [
            [0, 0],
            [120, 40],
          ],
          startBinding: 'shape-a',
          endBinding: 'shape-b',
        },
      }),
      makeElement({
        id: 'image-1',
        type: 'image',
        zIndex: 43,
        props: {
          strokeColor: '#000000',
          fillColor: '#ffffff',
          strokeWidth: 1,
          strokeStyle: 'solid',
          opacity: 1,
          src: 'data:image/png;base64,AAAA',
        },
      }),
    ];

    const document = buildNativeFileDocument({
      elements,
      camera,
      room: {
        id: 'room-1',
        name: 'Ops Map',
        source: 'saved',
        exportedAt: '2026-07-01T00:00:00.000Z',
      },
      assets: [{ id: 'image-1', src: 'data:image/png;base64,AAAA', mimeType: 'image/png' }],
    });

    expect(parseNativeFileText(serializeNativeFile(document))).toEqual(document);
  });

  it('skips unsupported element objects with a normalization report', () => {
    // @covers AC-4
    const document = buildNativeFileDocument({
      elements: [makeElement({ id: 'valid-1' })],
      camera,
      room: {
        id: 'room-1',
        name: 'Ops Map',
        source: 'saved',
        exportedAt: '2026-07-01T00:00:00.000Z',
      },
    });
    const parsed = JSON.parse(serializeNativeFile(document)) as Record<string, unknown>;
    parsed.elements = [
      document.elements[0],
      {
        ...document.elements[0],
        id: 'unsupported-1',
        type: 'unsupported-shape',
      },
    ];

    const result = parseNativeFileTextWithReport(JSON.stringify(parsed));

    expect(result.document.elements).toEqual(document.elements);
    expect(result.report).toEqual({
      importedCount: 1,
      skippedCount: 1,
      skipped: [{ index: 1, reason: 'Element type "unsupported-shape" is unsupported.' }],
    });
  });

  it('rejects malformed JSON and unsupported schemas with clear errors', () => {
    // @covers AC-4
    expect(() => parseNativeFileText('{')).toThrow('File is not valid JSON.');
    expect(() =>
      parseNativeFileText(
        JSON.stringify({
          kind: 'vdt.whiteboard.native',
          schemaVersion: 999,
          room: { id: null, name: null, source: 'local', exportedAt: 'now' },
          camera,
          elements: [],
        }),
      ),
    ).toThrow('Native file schema version is not supported.');
  });

  it('creates stable native backup filenames', () => {
    expect(createNativeFileName('Mission Board #1', 'saved')).toBe('mission-board-1.vdt.json');
    expect(createNativeFileName(null, 'local')).toBe('local-board.vdt.json');
  });
});

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'element-1',
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    angle: 0,
    zIndex: 1,
    props: {
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 123,
    updatedAt: 1700000000000,
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'user-1',
    ...overrides,
  };
}
