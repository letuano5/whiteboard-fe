import { describe, expect, it } from 'vitest';
import {
  SYNC_PROTOCOL_VERSION,
  SYNC_SCHEMA_VERSION,
  getSlotClockKey,
  getStaleReadPreconditions,
  validateSyncCommand,
  type PatchSlotsCommand,
  type UpdateArrowBindingCommand,
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

describe('P5-02 shared sync invariants', () => {
  it('@covers AC-6 validates baseClock zero, rejects null clocks and future slot clocks', () => {
    const unsetSlotPatch: PatchSlotsCommand = {
      ...envelope,
      kind: 'patch-slots',
      patches: [
        {
          elementId: 'el-1',
          slot: 'style.fillColor',
          baseClock: 0,
          changes: { fillColor: '#fff' },
        },
      ],
    };
    expect(validateSyncCommand(unsetSlotPatch, { currentSlotClocks: new Map() })).toEqual({
      ok: true,
    });

    const nullClockPatch = {
      ...envelope,
      kind: 'patch-slots',
      patches: [
        {
          elementId: 'el-1',
          slot: 'style.fillColor',
          baseClock: null,
          changes: { fillColor: '#fff' },
        },
      ],
    };
    expect(validateSyncCommand(nullClockPatch)).toMatchObject({ ok: false });

    const futurePatch: PatchSlotsCommand = {
      ...envelope,
      kind: 'patch-slots',
      patches: [
        {
          elementId: 'el-1',
          slot: 'style.fillColor',
          baseClock: 3,
          changes: { fillColor: '#fff' },
        },
      ],
    };
    expect(
      validateSyncCommand(futurePatch, {
        currentSlotClocks: new Map([[getSlotClockKey('el-1', 'style.fillColor'), 2]]),
      }),
    ).toEqual({ ok: false, errors: ['STALE_CLIENT_STATE'] });
  });

  it('@covers AC-7 classifies stale read preconditions by requested branch', () => {
    const command: PatchSlotsCommand = {
      ...envelope,
      kind: 'patch-slots',
      readPreconditions: [
        { elementId: 'shape-1', slot: 'transform.position', baseClock: 5, onStale: 'reject' },
        { elementId: 'shape-1', slot: 'transform.size', baseClock: 6, onStale: 'rebase' },
        {
          elementId: 'arrow-1',
          slot: 'geometry.points',
          baseClock: 7,
          onStale: 'server_recompute',
        },
      ],
      patches: [
        {
          elementId: 'shape-1',
          slot: 'style.fillColor',
          baseClock: 1,
          changes: { fillColor: '#fff' },
        },
      ],
    };
    const currentSlotClocks = new Map([
      [getSlotClockKey('shape-1', 'style.fillColor'), 1],
      [getSlotClockKey('shape-1', 'transform.position'), 6],
      [getSlotClockKey('shape-1', 'transform.size'), 7],
      [getSlotClockKey('arrow-1', 'geometry.points'), 8],
    ]);

    expect(
      getStaleReadPreconditions(command, { currentSlotClocks }).map((item) => item.onStale),
    ).toEqual(['reject', 'rebase', 'server_recompute']);
    expect(validateSyncCommand(command, { currentSlotClocks })).toEqual({
      ok: false,
      errors: ['STALE_CLIENT_STATE'],
    });
    expect(
      validateSyncCommand(
        {
          ...command,
          readPreconditions: command.readPreconditions!.map((precondition) => ({
            ...precondition,
            onStale: 'rebase' as const,
          })),
        },
        { currentSlotClocks },
      ),
    ).toEqual({ ok: true });
  });

  it('@covers AC-8 validates P5 arrow binding command and command-level request rules', () => {
    const command: UpdateArrowBindingCommand = {
      ...envelope,
      kind: 'update-arrow-binding',
      arrowId: 'arrow-1',
      terminal: 'end',
      binding: { elementId: 'shape-1', anchorRatio: { x: 0.25, y: 0.75 } },
      baseBindingClock: 2,
      baseGeometryClock: 3,
    };
    expect(validateSyncCommand(command)).toEqual({ ok: true });
    expect(validateSyncCommand({ ...command, binding: { elementId: 'shape-1' } })).toMatchObject({
      ok: false,
    });
    expect(
      validateSyncCommand({
        ...command,
        binding: { elementId: 'shape-1', anchorRatio: { x: 1.25, y: 0.5 } },
      }),
    ).toMatchObject({ ok: false });
    expect(validateSyncCommand({ ...command, batchId: 'batch-1' })).toEqual({
      ok: false,
      errors: ['SyncCommand must not include batchId.'],
    });

    const patchLevelAck = {
      ...envelope,
      kind: 'patch-slots',
      patches: [
        {
          elementId: 'el-1',
          slot: 'style.fillColor',
          baseClock: 1,
          changes: { fillColor: '#fff' },
          requestId: 'patch-request',
          ack: true,
        },
      ],
    };
    expect(validateSyncCommand(patchLevelAck)).toMatchObject({ ok: false });

    expect(
      validateSyncCommand({
        ...envelope,
        kind: 'replace-document',
        elements: [makeElement({ id: 'replacement-manual' })],
        reason: 'manual_replace',
      }),
    ).toEqual({ ok: true });
  });

  it('validates P5-06 transient delivery hints for non-resendable intermediate patches', () => {
    const transientPatch = {
      ...envelope,
      kind: 'patch-slots',
      persistence: {
        transient: true,
        resendable: false,
        storeProcessedRequest: false,
        durability: 'relaxed',
      },
      patches: [
        {
          elementId: 'el-1',
          slot: 'transform.position',
          baseClock: 1,
          changes: { x: 12, y: 24 },
        },
      ],
    };

    expect(validateSyncCommand(transientPatch)).toEqual({ ok: true });
    expect(
      validateSyncCommand({
        ...transientPatch,
        persistence: { ...transientPatch.persistence, resendable: true },
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateSyncCommand({
        ...envelope,
        kind: 'delete-elements',
        persistence: { transient: true, resendable: false, storeProcessedRequest: false },
        elementIds: ['el-1'],
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateSyncCommand({
        ...transientPatch,
        persistence: { resendable: true, storeProcessedRequest: false },
      }),
    ).toMatchObject({ ok: false });
  });
});
