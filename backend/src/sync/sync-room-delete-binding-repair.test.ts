import type {
  CreateElementCommand,
  DeleteElementsCommand,
  Element,
  PatchSlotsCommand,
  ReplaceDocumentCommand,
  SlotClockUpdate,
  SyncSlot,
  UpdateArrowBindingCommand,
} from '@vdt/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION } from '@vdt/shared';
import { describe, expect, it } from 'vitest';
import { makeElement } from '../test/element-fixtures.js';
import { SyncRoom, type SyncRoomActorContext } from './sync-room.js';
import { MAX_ELEMENTS_PER_DELETE, MAX_REPAIRED_ARROWS_PER_COMMAND } from './sync-room-limits.js';
import { applySlotPatch } from './sync-room-slot-patches.js';

const editor: SyncRoomActorContext = { actorId: 'editor-1', effectiveRole: 'editor' };

describe('P5-08 SyncRoom delete, tombstone, and binding repair', () => {
  it('deletes a bound target, tombstones it, and clears repaired arrow bindings', async () => {
    // @covers AC-1
    // @covers AC-2
    const target = makeElement({ id: 'target', x: 0, y: 0, width: 100, height: 100 });
    const other = makeElement({ id: 'other', x: 200, y: 0, width: 100, height: 100 });
    const arrow = makeArrow({
      id: 'arrow',
      points: [
        [50, 50],
        [200, 50],
      ],
      startBinding: binding('target', 0.5, 0.5),
      endBinding: binding('other', 0, 0.5),
    });
    const room = createRoom([target, other, arrow]);

    const result = await room.execute(deleteCommand('delete-target', ['target']), editor);

    const snapshot = room.getStateSnapshot();
    const repaired = snapshot.elements.get('arrow');
    expect(snapshot.elements.has('target')).toBe(false);
    expect(snapshot.tombstoneElementIds.has('target')).toBe(true);
    expect(repaired?.props.startBinding ?? null).toBeNull();
    expect(repaired?.props.endBinding).toEqual(binding('other', 0, 0.5));
    expect(repaired?.props.points).toEqual([
      [50, 50],
      [200, 50],
    ]);
    expect(result.changeSet.deleted).toEqual(['target']);
    expect(result.changeSet.slotPatches.map((patch) => patch.slot)).toEqual(
      expect.arrayContaining([
        'binding.start',
        'geometry.startPoint',
        'geometry.endPoint',
        'geometry.route',
      ]),
    );

    const peerArrow = result.changeSet.slotPatches.reduce(applySlotPatch, arrow);
    expect(peerArrow).toEqual(repaired);
  });

  it('rejects create and replace resurrection for ids retained in tombstones', async () => {
    // @covers AC-3
    const room = new SyncRoom({ roomId: 'room-1', tombstoneElementIds: ['dead-shape'] });

    await expect(
      room.execute(createCommand('create-dead', makeElement({ id: 'dead-shape' })), editor),
    ).rejects.toMatchObject({ code: 'DUPLICATE_ELEMENT_ID' });

    expect(room.getStateSnapshot().elements.has('dead-shape')).toBe(false);
    expect(room.getStateSnapshot().documentClock).toBe(0);

    await expect(
      room.execute(replaceCommand('replace-dead', [makeElement({ id: 'dead-shape' })]), editor),
    ).rejects.toMatchObject({ code: 'DUPLICATE_ELEMENT_ID' });
    expect(room.getStateSnapshot().elements.has('dead-shape')).toBe(false);
    expect(room.getStateSnapshot().documentClock).toBe(0);
  });

  it('rejects delete and repair limit violations without partial commit', async () => {
    // @covers AC-4
    const tooManyDeletes = Array.from(
      { length: MAX_ELEMENTS_PER_DELETE + 1 },
      (_, index) => `shape-${index}`,
    );
    const deleteRoom = createRoom([makeElement({ id: 'shape-0' })]);
    await expect(
      deleteRoom.execute(deleteCommand('too-many-deletes', tooManyDeletes), editor),
    ).rejects.toMatchObject({ code: 'TOO_LARGE' });
    expect(deleteRoom.getStateSnapshot().documentClock).toBe(0);

    const target = makeElement({ id: 'target' });
    const repairedArrows = Array.from({ length: MAX_REPAIRED_ARROWS_PER_COMMAND + 1 }, (_, index) =>
      makeArrow({
        id: `arrow-${index}`,
        startBinding: binding('target', 0.5, 0.5),
      }),
    );
    const repairRoom = createRoom([target, ...repairedArrows]);

    await expect(
      repairRoom.execute(
        patchCommand('move-target', [patch('target', 'transform.position', 0, { x: 10, y: 20 })]),
        editor,
      ),
    ).rejects.toMatchObject({ code: 'TOO_LARGE' });
    expect(repairRoom.getStateSnapshot().documentClock).toBe(0);
    expect(repairRoom.getStateSnapshot().elements.get('target')).toMatchObject({ x: 0, y: 0 });
  });

  it('repairs bound arrow geometry in the same server clock as target movement', async () => {
    // @covers AC-5
    const target = makeElement({ id: 'target', x: 0, y: 0, width: 100, height: 100 });
    const arrow = makeArrow({
      id: 'arrow',
      points: [
        [0, 0],
        [0, 50],
      ],
      endBinding: binding('target', 0, 0.5),
    });
    const room = createRoom(
      [target, arrow],
      [slotClock('target', 'transform.position', 0), slotClock('arrow', 'geometry.endPoint', 0)],
    );

    const result = await room.execute(
      patchCommand('move-target', [patch('target', 'transform.position', 0, { x: 100, y: 0 })]),
      editor,
    );

    const repaired = getElement(room, 'arrow');
    expect(repaired.props.points?.at(-1)).toEqual([100, 50]);
    expect(result.changeSet.serverClock).toBe(1);
    expect(result.changeSet.slotClocks).toEqual(
      expect.arrayContaining([
        { elementId: 'target', slot: 'transform.position', clock: 1 },
        { elementId: 'arrow', slot: 'geometry.endPoint', clock: 1 },
      ]),
    );
  });

  it('preserves concurrent start and end binding updates on the same arrow', async () => {
    // @covers AC-6
    const startTarget = makeElement({ id: 'start-target', x: 0, y: 0, width: 100, height: 100 });
    const endTarget = makeElement({ id: 'end-target', x: 300, y: 0, width: 100, height: 100 });
    const arrow = makeArrow({
      id: 'arrow',
      points: [
        [10, 10],
        [20, 20],
      ],
    });
    const room = createRoom([startTarget, endTarget, arrow]);

    await room.execute(
      updateBindingCommand('bind-start', 'arrow', 'start', binding('start-target', 1, 0.5)),
      editor,
    );
    await room.execute(
      updateBindingCommand('bind-end', 'arrow', 'end', binding('end-target', 0, 0.5)),
      editor,
    );

    const repaired = getElement(room, 'arrow');
    expect(repaired.props.startBinding).toEqual(binding('start-target', 1, 0.5));
    expect(repaired.props.endBinding).toEqual(binding('end-target', 0, 0.5));
    expect(repaired.props.points).toEqual([
      [100, 50],
      [300, 50],
    ]);
  });

  it('rejects binding updates to missing or deleted targets', async () => {
    // @covers AC-7
    const arrow = makeArrow({ id: 'arrow' });

    await expect(
      createRoom([arrow]).execute(
        updateBindingCommand('missing-target', 'arrow', 'start', binding('missing', 0.5, 0.5)),
        editor,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_BINDING_TARGET' });

    await expect(
      new SyncRoom({
        roomId: 'room-1',
        elements: [arrow],
        tombstoneElementIds: ['deleted-target'],
      }).execute(
        updateBindingCommand(
          'deleted-target',
          'arrow',
          'start',
          binding('deleted-target', 0.5, 0.5),
        ),
        editor,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_BINDING_TARGET' });
  });

  it('rejects new deletes for tombstoned ids while replaying the original delete retry', async () => {
    // @covers AC-8
    const room = createRoom([makeElement({ id: 'shape' })]);
    const command = deleteCommand('delete-shape', ['shape']);

    const first = await room.execute(command, editor);
    const retry = await room.execute(command, editor);
    await expect(
      room.execute(deleteCommand('delete-shape-again', ['shape']), editor),
    ).rejects.toMatchObject({
      code: 'ELEMENT_DELETED',
    });

    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(retry.changeSet).toBe(first.changeSet);
    expect(room.getStateSnapshot().documentClock).toBe(1);
  });
});

function createRoom(elements: Element[], slotClocks: SlotClockUpdate[] = []): SyncRoom {
  return new SyncRoom({ roomId: 'room-1', elements, slotClocks });
}

function getElement(room: SyncRoom, elementId: string): Element {
  const element = room.getStateSnapshot().elements.get(elementId);
  if (!element) throw new Error(`Missing test element ${elementId}.`);
  return element;
}

function makeArrow({
  id,
  points = [
    [0, 0],
    [100, 100],
  ],
  startBinding = null,
  endBinding = null,
}: {
  id: string;
  points?: [number, number][];
  startBinding?: Element['props']['startBinding'];
  endBinding?: Element['props']['endBinding'];
}): Element {
  return makeElement({
    id,
    type: 'arrow',
    x: points[0]?.[0] ?? 0,
    y: points[0]?.[1] ?? 0,
    width: Math.abs((points.at(-1)?.[0] ?? 0) - (points[0]?.[0] ?? 0)),
    height: Math.abs((points.at(-1)?.[1] ?? 0) - (points[0]?.[1] ?? 0)),
    props: {
      ...makeElement().props,
      points,
      startBinding,
      endBinding,
    },
  });
}

function binding(elementId: string, x: number, y: number) {
  return { elementId, anchorRatio: { x, y } };
}

function slotClock(elementId: string, slot: SyncSlot, clock: number): SlotClockUpdate {
  return { elementId, slot, clock };
}

function patch<S extends SyncSlot>(
  elementId: string,
  slot: S,
  baseClock: number,
  changes: PatchSlotsCommand['patches'][number]['changes'],
) {
  return { elementId, slot, baseClock, changes };
}

function patchCommand(requestId: string, patches: PatchSlotsCommand['patches']): PatchSlotsCommand {
  return { ...envelope(requestId), kind: 'patch-slots', patches };
}

function deleteCommand(requestId: string, elementIds: string[]): DeleteElementsCommand {
  return { ...envelope(requestId), kind: 'delete-elements', elementIds };
}

function createCommand(requestId: string, element: Element): CreateElementCommand {
  return { ...envelope(requestId), kind: 'create-element', element };
}

function replaceCommand(requestId: string, elements: Element[]): ReplaceDocumentCommand {
  return { ...envelope(requestId), kind: 'replace-document', elements, reason: 'manual_replace' };
}

function updateBindingCommand(
  requestId: string,
  arrowId: string,
  terminal: UpdateArrowBindingCommand['terminal'],
  nextBinding: UpdateArrowBindingCommand['binding'],
): UpdateArrowBindingCommand {
  return {
    ...envelope(requestId),
    kind: 'update-arrow-binding',
    arrowId,
    terminal,
    binding: nextBinding,
    baseBindingClock: 0,
    baseGeometryClock: 0,
  };
}

function envelope(requestId: string): Omit<PatchSlotsCommand, 'kind' | 'patches'> {
  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    clientClock: 1,
    baseRoomEpoch: 0,
  };
}
