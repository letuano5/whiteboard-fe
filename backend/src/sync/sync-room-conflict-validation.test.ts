import type {
  CreateElementCommand,
  DeleteElementsCommand,
  Element,
  PatchSlotsCommand,
  ReorderElementsCommand,
  SlotClockUpdate,
  SlotPatch,
  SyncSlot,
} from '@vdt/shared';
import { SYNC_PROTOCOL_VERSION, SYNC_SCHEMA_VERSION } from '@vdt/shared';
import { describe, expect, it } from 'vitest';
import { makeElement } from '../test/element-fixtures.js';
import { SyncRoom, type SyncRoomActorContext, type SyncRoomPlanner } from './sync-room.js';
import { MAX_ELEMENTS_PER_DELETE, MAX_PATCHES_PER_COMMAND } from './sync-room-limits.js';

const editor: SyncRoomActorContext = { actorId: 'editor-1', effectiveRole: 'editor' };

describe('P5-04 SyncRoom conflict resolution and validation', () => {
  it('preserves concurrent move and fill-color updates on different slots', async () => {
    // @covers AC-1
    const room = createRoomWithElement(makeElement({ id: 'shape' }), [
      slotClock('shape', 'transform.position', 1),
      slotClock('shape', 'style.fillColor', 1),
    ]);

    await room.execute(
      patchCommand('move', [patch('shape', 'transform.position', 1, { x: 24, y: 36 })]),
      editor,
    );
    await room.execute(
      patchCommand('fill', [patch('shape', 'style.fillColor', 1, { fillColor: '#ff0000' })]),
      editor,
    );

    const element = getElement(room, 'shape');
    expect(element).toMatchObject({ x: 24, y: 36 });
    expect(element.props.fillColor).toBe('#ff0000');
  });

  it('preserves concurrent fill-color and stroke-width style slots', async () => {
    // @covers AC-2
    const room = createRoomWithElement(makeElement({ id: 'shape' }), [
      slotClock('shape', 'style.fillColor', 1),
      slotClock('shape', 'style.strokeWidth', 1),
    ]);

    await room.execute(
      patchCommand('fill', [patch('shape', 'style.fillColor', 1, { fillColor: '#00ff00' })]),
      editor,
    );
    await room.execute(
      patchCommand('stroke-width', [patch('shape', 'style.strokeWidth', 1, { strokeWidth: 8 })]),
      editor,
    );

    const element = getElement(room, 'shape');
    expect(element.props.fillColor).toBe('#00ff00');
    expect(element.props.strokeWidth).toBe(8);
  });

  it('preserves concurrent text and style slots', async () => {
    // @covers AC-3
    const room = createRoomWithElement(makeElement({ id: 'label', type: 'text' }), [
      slotClock('label', 'text.text', 1),
      slotClock('label', 'style.strokeColor', 1),
    ]);

    await room.execute(
      patchCommand('text', [patch('label', 'text.text', 1, { text: 'Alpha' })]),
      editor,
    );
    await room.execute(
      patchCommand('stroke', [patch('label', 'style.strokeColor', 1, { strokeColor: '#123456' })]),
      editor,
    );

    const element = getElement(room, 'label');
    expect(element.props.text).toBe('Alpha');
    expect(element.props.strokeColor).toBe('#123456');
  });

  it('preserves concurrent move and resize transform slots', async () => {
    // @covers AC-4
    const room = createRoomWithElement(makeElement({ id: 'shape' }), [
      slotClock('shape', 'transform.position', 1),
      slotClock('shape', 'transform.size', 1),
    ]);

    await room.execute(
      patchCommand('move', [patch('shape', 'transform.position', 1, { x: 40, y: 50 })]),
      editor,
    );
    await room.execute(
      patchCommand('resize', [patch('shape', 'transform.size', 1, { width: 160, height: 90 })]),
      editor,
    );

    expect(getElement(room, 'shape')).toMatchObject({ x: 40, y: 50, width: 160, height: 90 });
  });

  it('resolves concurrent same-slot move updates by latest server commit', async () => {
    // @covers AC-5
    const room = createRoomWithElement(makeElement({ id: 'shape' }), [
      slotClock('shape', 'transform.position', 1),
    ]);

    await room.execute(
      patchCommand('move-a', [patch('shape', 'transform.position', 1, { x: 10, y: 10 })]),
      editor,
    );
    await room.execute(
      patchCommand('move-b', [patch('shape', 'transform.position', 1, { x: 99, y: 88 })]),
      editor,
    );

    expect(getElement(room, 'shape')).toMatchObject({ x: 99, y: 88 });
    expect(room.getStateSnapshot().slotClocks.get('shape:transform.position')).toBe(3);
  });

  it('resolves concurrent same-slot resize updates by latest server commit', async () => {
    // @covers AC-6
    const room = createRoomWithElement(makeElement({ id: 'shape' }), [
      slotClock('shape', 'transform.size', 1),
    ]);

    await room.execute(
      patchCommand('resize-a', [patch('shape', 'transform.size', 1, { width: 120, height: 80 })]),
      editor,
    );
    await room.execute(
      patchCommand('resize-b', [patch('shape', 'transform.size', 1, { width: 300, height: 200 })]),
      editor,
    );

    expect(getElement(room, 'shape')).toMatchObject({ width: 300, height: 200 });
    expect(room.getStateSnapshot().slotClocks.get('shape:transform.size')).toBe(3);
  });

  it('keeps deleted elements deleted when a later patch targets them', async () => {
    // @covers AC-7
    const room = createRoomWithElement(makeElement({ id: 'shape' }));

    await room.execute(deleteCommand('delete-shape', ['shape']), editor);
    await expect(
      room.execute(
        patchCommand('patch-deleted', [
          patch('shape', 'style.fillColor', 0, { fillColor: '#ff0000' }),
        ]),
        editor,
      ),
    ).rejects.toMatchObject({ code: 'ELEMENT_DELETED' });

    expect(room.getStateSnapshot().elements.has('shape')).toBe(false);
    expect(room.getStateSnapshot().documentClock).toBe(1);
  });

  it('rejects viewer actors before planner side effects run', async () => {
    // @covers AC-8
    let plannerCalls = 0;
    const planner: SyncRoomPlanner = () => {
      plannerCalls += 1;
      return { created: [makeElement({ id: 'created' })] };
    };
    const room = new SyncRoom({ roomId: 'room-1', planner });

    await expect(
      room.execute(createCommand('create-viewer', makeElement({ id: 'created' })), {
        actorId: 'viewer-1',
        effectiveRole: 'viewer',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(plannerCalls).toBe(0);
    expect(room.getStateSnapshot().documentClock).toBe(0);
  });

  it('rejects invalid asset and frame references before commit', async () => {
    // @covers AC-9
    const image = makeElement({ id: 'image', type: 'image' });
    const shape = makeElement({ id: 'shape' });

    await expect(
      createRoomWithElements([image]).execute(
        patchCommand('missing-asset', [patch('image', 'asset.src', 0, { src: 'asset-missing' })]),
        editor,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_VALUE' });

    await expect(
      createRoomWithElements([shape]).execute(
        patchCommand('missing-frame', [
          patch('shape', 'grouping.frameId', 0, { frameId: 'missing-frame' }),
        ]),
        editor,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_BINDING_TARGET' });
  });

  it('accepts grouping.groupId as an opaque shared tag, not an element reference', async () => {
    // @covers AC-9 — groupId is a client-generated tag shared by group members, never an
    // existing element's id, so it must not be validated as a binding target.
    const shape = makeElement({ id: 'shape' });
    const groupRoom = createRoomWithElements([shape]);

    await groupRoom.execute(
      patchCommand('assign-group', [
        patch('shape', 'transform.position', 0, { x: 10, y: 20 }),
        patch('shape', 'grouping.groupId', 0, { groupId: 'brand-new-group-id' }),
      ]),
      editor,
    );

    expect(getElement(groupRoom, 'shape')).toMatchObject({
      x: 10,
      y: 20,
      groupId: 'brand-new-group-id',
    });
  });

  it('rejects derived and local-only fields with INVALID_FIELD', async () => {
    // @covers AC-10
    const room = createRoomWithElement(makeElement({ id: 'shape' }));
    const invalidCommand = {
      ...patchCommand('derived-field', []),
      patches: [
        {
          elementId: 'shape',
          slot: 'style.fillColor',
          baseClock: 0,
          changes: { fillColor: '#000000', versionNonce: 123 },
        },
      ],
    } as unknown as PatchSlotsCommand;

    await expect(room.execute(invalidCommand, editor)).rejects.toMatchObject({
      code: 'INVALID_FIELD',
    });
  });

  it('rejects transform patches for linear elements and normalizes bbox from geometry', async () => {
    // @covers AC-11
    const line = makeElement({ id: 'line', type: 'line' });
    const room = createRoomWithElement(line);

    await expect(
      room.execute(
        patchCommand('move-line', [patch('line', 'transform.position', 0, { x: 100, y: 100 })]),
        editor,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_SLOT_FOR_ELEMENT_TYPE' });

    await room.execute(
      patchCommand('line-points', [
        patch('line', 'geometry.points', 0, {
          points: [
            [50, 90],
            [10, 20],
            [70, 40],
          ],
        }),
      ]),
      editor,
    );

    const updated = getElement(room, 'line');
    expect(updated.props.points).toEqual([
      [50, 90],
      [10, 20],
      [70, 40],
    ]);
    expect(updated).toMatchObject({ x: 10, y: 20, width: 60, height: 70 });
  });

  it('commits reorder commands through the order slot', async () => {
    const room = createRoomWithElements(
      [makeElement({ id: 'bottom', zIndex: 1 }), makeElement({ id: 'top', zIndex: 2 })],
      [slotClock('bottom', 'order', 1), slotClock('top', 'order', 1)],
    );

    const result = await room.execute(
      reorderCommand('bring-bottom-to-front', [
        { elementId: 'bottom', afterElementId: 'top', baseOrderClock: 1 },
      ]),
      editor,
    );

    expect(result.changeSet.reason).toBe('reorder');
    expect(getElement(room, 'top').zIndex).toBe(1);
    expect(getElement(room, 'bottom').zIndex).toBe(2);
    expect(room.getStateSnapshot().slotClocks.get('bottom:order')).toBe(2);
    expect(room.getStateSnapshot().slotClocks.get('top:order')).toBe(2);
    expect(result.changeSet.slotPatches.map((patchValue) => patchValue.slot)).toEqual([
      'order',
      'order',
    ]);
  });

  it('rejects commands exceeding patch, delete, or change-set limits', async () => {
    // @covers AC-12
    const tooManyPatches = Array.from({ length: MAX_PATCHES_PER_COMMAND + 1 }, (_, index) =>
      patch(`shape-${index}`, 'style.fillColor', 0, { fillColor: '#000000' }),
    );
    await expect(
      createRoomWithElement(makeElement({ id: 'shape-0' })).execute(
        patchCommand('too-many-patches', tooManyPatches),
        editor,
      ),
    ).rejects.toMatchObject({ code: 'TOO_LARGE' });

    const tooManyDeletes = Array.from(
      { length: MAX_ELEMENTS_PER_DELETE + 1 },
      (_, index) => `shape-${index}`,
    );
    await expect(
      createRoomWithElement(makeElement({ id: 'shape-0' })).execute(
        deleteCommand('too-many-deletes', tooManyDeletes),
        editor,
      ),
    ).rejects.toMatchObject({ code: 'TOO_LARGE' });

    const textRoom = new SyncRoom({
      roomId: 'room-1',
      elements: [makeElement({ id: 'label', type: 'text' })],
      maxChangeSetBytes: 200,
    });
    await expect(
      textRoom.execute(
        patchCommand('too-large-changeset', [
          patch('label', 'text.text', 0, { text: 'x'.repeat(500) }),
        ]),
        editor,
      ),
    ).rejects.toMatchObject({ code: 'TOO_LARGE' });
    expect(textRoom.getStateSnapshot().documentClock).toBe(0);
  });
});

function createRoomWithElement(element: Element, slotClocks: SlotClockUpdate[] = []): SyncRoom {
  return createRoomWithElements([element], slotClocks);
}

function createRoomWithElements(elements: Element[], slotClocks: SlotClockUpdate[] = []): SyncRoom {
  return new SyncRoom({
    roomId: 'room-1',
    elements,
    documentClock: slotClocks.length > 0 ? 1 : 0,
    slotClocks,
  });
}

function getElement(room: SyncRoom, elementId: string): Element {
  const element = room.getStateSnapshot().elements.get(elementId);
  if (!element) throw new Error(`Missing test element ${elementId}.`);
  return element;
}

function slotClock(elementId: string, slot: SyncSlot, clock: number): SlotClockUpdate {
  return { elementId, slot, clock };
}

function patch<S extends SyncSlot>(
  elementId: string,
  slot: S,
  baseClock: number,
  changes: SlotPatch<S>['changes'],
): SlotPatch<S> {
  return { elementId, slot, baseClock, changes };
}

function patchCommand(requestId: string, patches: SlotPatch[]): PatchSlotsCommand {
  return {
    ...envelope(requestId),
    kind: 'patch-slots',
    patches,
  };
}

function deleteCommand(requestId: string, elementIds: string[]): DeleteElementsCommand {
  return {
    ...envelope(requestId),
    kind: 'delete-elements',
    elementIds,
  };
}

function reorderCommand(
  requestId: string,
  moves: ReorderElementsCommand['moves'],
): ReorderElementsCommand {
  return {
    ...envelope(requestId),
    kind: 'reorder-elements',
    moves,
  };
}

function createCommand(requestId: string, element: Element): CreateElementCommand {
  return {
    ...envelope(requestId),
    kind: 'create-element',
    element,
  };
}

function envelope(requestId: string): Omit<PatchSlotsCommand, 'kind' | 'patches'> {
  return {
    protocolVersion: SYNC_PROTOCOL_VERSION,
    schemaVersion: SYNC_SCHEMA_VERSION,
    roomId: 'room-1',
    requestId,
    clientClock: 10,
    baseRoomEpoch: 0,
  };
}
