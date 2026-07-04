import { describe, expect, it } from 'vitest';
import {
  ELEMENT_FIELD_SYNC_CLASSIFICATION,
  ELEMENT_PROPS_FIELD_SYNC_CLASSIFICATION,
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  materializeCreatedElement,
  validateSyncCommand,
  type CreateElementCommand,
  type PatchSlotsCommand,
  type ReorderElementsCommand,
  type SyncCommand,
} from '@vdt/shared';
import { makeElement } from '../test/element-fixtures.js';

const envelope = {
  protocolVersion: SYNC_PROTOCOL_VERSION,
  schemaVersion: SYNC_SCHEMA_VERSION,
  roomId: 'room-1',
  requestId: 'request-1',
  clientClock: 10,
  baseRoomEpoch: 2,
} as const;

const elementFields = [
  'id',
  'type',
  'x',
  'y',
  'width',
  'height',
  'angle',
  'zIndex',
  'props',
  'version',
  'versionNonce',
  'updatedAt',
  'isDeleted',
  'groupId',
  'frameId',
  'locked',
  'createdBy',
];

const elementPropsFields = [
  'strokeColor',
  'fillColor',
  'strokeWidth',
  'strokeStyle',
  'opacity',
  'roughness',
  'points',
  'text',
  'fontSize',
  'fontFamily',
  'textAlign',
  'src',
  'startBinding',
  'endBinding',
  'url',
];

describe('P5-02 shared sync contracts', () => {
  it('@covers AC-1 maps every mutable Element field to a slot or explicit classification', () => {
    expect(Object.keys(ELEMENT_FIELD_SYNC_CLASSIFICATION).sort()).toEqual(
      [...elementFields].sort(),
    );
    expect(Object.keys(ELEMENT_PROPS_FIELD_SYNC_CLASSIFICATION).sort()).toEqual(
      [...elementPropsFields].sort(),
    );
    expect(ELEMENT_FIELD_SYNC_CLASSIFICATION.x).toEqual({
      category: 'slot',
      slot: 'transform.position',
    });
    expect(ELEMENT_FIELD_SYNC_CLASSIFICATION.version).toEqual({ category: 'legacy-only' });
    expect(ELEMENT_FIELD_SYNC_CLASSIFICATION.isDeleted).toMatchObject({ category: 'non-sync' });
    expect(ELEMENT_PROPS_FIELD_SYNC_CLASSIFICATION.startBinding).toEqual({
      category: 'slot',
      slot: 'binding.start',
    });
    expect(ELEMENT_FIELD_SYNC_CLASSIFICATION.locked).toEqual({
      category: 'slot',
      slot: 'state.locked',
    });
  });

  it('@covers AC-2 rejects malformed slot patches and duplicate slots', () => {
    const duplicateSlots: PatchSlotsCommand = {
      ...envelope,
      kind: 'patch-slots',
      patches: [
        {
          elementId: 'el-1',
          slot: 'transform.position',
          baseClock: 1,
          changes: { x: 1, y: 2 },
        },
        {
          elementId: 'el-1',
          slot: 'transform.position',
          baseClock: 1,
          changes: { x: 3, y: 4 },
        },
      ],
    };

    expect(validateSyncCommand(duplicateSlots)).toEqual({
      ok: false,
      errors: ['PatchSlotsCommand contains duplicate element slot patches.'],
    });

    const incompletePatch = {
      ...envelope,
      kind: 'patch-slots',
      patches: [
        {
          elementId: 'el-1',
          slot: 'transform.position',
          baseClock: 1,
          changes: { x: 1 },
        },
      ],
    };
    expect(validateSyncCommand(incompletePatch)).toMatchObject({ ok: false });

    const unknownFieldPatch = {
      ...envelope,
      kind: 'patch-slots',
      patches: [
        {
          elementId: 'el-1',
          slot: 'style.strokeColor',
          baseClock: 1,
          changes: { strokeColor: '#fff', fillColor: '#000' },
        },
      ],
    };
    expect(validateSyncCommand(unknownFieldPatch)).toMatchObject({ ok: false });

    const deletedPatch = {
      ...envelope,
      kind: 'patch-slots',
      patches: [
        {
          elementId: 'el-1',
          slot: 'state.locked',
          baseClock: 1,
          changes: { locked: true, isDeleted: true },
        },
      ],
    };
    expect(validateSyncCommand(deletedPatch)).toMatchObject({ ok: false });
  });

  it('@covers AC-3 defines all command variants with shared envelope and no actorId', () => {
    const commands: SyncCommand[] = [
      { ...envelope, kind: 'create-element', element: makeElement({ id: 'new-el' }) },
      {
        ...envelope,
        kind: 'patch-slots',
        patches: [
          {
            elementId: 'el-1',
            slot: 'transform.size',
            baseClock: 1,
            changes: { width: 10, height: 20 },
          },
        ],
      },
      { ...envelope, kind: 'reorder-elements', moves: [{ elementId: 'el-1' }] },
      {
        ...envelope,
        kind: 'update-arrow-binding',
        arrowId: 'arrow-1',
        terminal: 'start',
        binding: { elementId: 'shape-a', anchorRatio: { x: 0.5, y: 0.5 } },
        baseBindingClock: 1,
        baseGeometryClock: 2,
      },
      { ...envelope, kind: 'delete-elements', elementIds: ['el-1'] },
      {
        ...envelope,
        kind: 'restore-elements',
        elements: [makeElement({ id: 'restored-el' })],
      },
      {
        ...envelope,
        kind: 'replace-document',
        elements: [makeElement({ id: 'replacement' })],
        reason: 'import',
      },
    ];

    for (const command of commands) {
      expect(validateSyncCommand(command)).toEqual({ ok: true });
    }

    expect(validateSyncCommand({ ...commands[0], actorId: 'malicious-client-actor' })).toEqual({
      ok: false,
      errors: ['SyncCommand payload must not include actorId.'],
    });
  });

  it('@covers AC-4 validates create preconditions and materializes server-normalized order', () => {
    const command: CreateElementCommand = {
      ...envelope,
      kind: 'create-element',
      element: makeElement({ id: 'created-el', zIndex: 3, isDeleted: true }),
      orderHint: { afterElementId: 'left-neighbor', baseOrderClock: 7 },
    };

    expect(validateSyncCommand(command)).toEqual({ ok: true });
    expect(
      validateSyncCommand(command, { activeElementIds: new Set(['created-el']) }),
    ).toMatchObject({ ok: false });
    expect(
      validateSyncCommand(command, { tombstoneElementIds: new Set(['created-el']) }),
    ).toMatchObject({ ok: false });

    const materialized = materializeCreatedElement(command, { zIndex: 9, updatedAt: 123 });
    expect(materialized.element).toMatchObject({
      id: 'created-el',
      zIndex: 9,
      updatedAt: 123,
      isDeleted: false,
    });
    expect(materialized.normalizedOrder).toEqual({ elementId: 'created-el', zIndex: 9 });
  });

  it('validates restore preconditions against active records and tombstones', () => {
    const command: SyncCommand = {
      ...envelope,
      kind: 'restore-elements',
      elements: [makeElement({ id: 'restored-el', isDeleted: true })],
    };

    expect(validateSyncCommand(command, { tombstoneElementIds: new Set(['restored-el']) })).toEqual(
      { ok: true },
    );
    expect(
      validateSyncCommand(command, { activeElementIds: new Set(['restored-el']) }),
    ).toMatchObject({ ok: false });
    expect(validateSyncCommand(command, { tombstoneElementIds: new Set() })).toMatchObject({
      ok: false,
    });
  });

  it('@covers AC-5 rejects direct order patches but accepts reorder commands', () => {
    const orderPatch: PatchSlotsCommand = {
      ...envelope,
      kind: 'patch-slots',
      patches: [{ elementId: 'el-1', slot: 'order', baseClock: 1, changes: { zIndex: 99 } }],
    };
    expect(validateSyncCommand(orderPatch)).toMatchObject({ ok: false });

    const reorder: ReorderElementsCommand = {
      ...envelope,
      kind: 'reorder-elements',
      moves: [{ elementId: 'el-1', afterElementId: 'el-0', baseOrderClock: 1 }],
    };
    expect(validateSyncCommand(reorder)).toEqual({ ok: true });
  });
});
