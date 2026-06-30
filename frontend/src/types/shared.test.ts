import { describe, it, expect } from 'vitest';
import { WS_EVENTS, doesIncomingElementWin, type Element } from './shared';

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: 'el-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle: 0,
    zIndex: 0,
    props: {
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 500,
    updatedAt: 0,
    isDeleted: false,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
    ...overrides,
  };
}

describe('WS_EVENTS', () => {
  it('uses kebab-case string values', () => {
    Object.values(WS_EVENTS).forEach((value) => {
      expect(value).toMatch(/^[a-z]+(-[a-z]+)*$/);
    });
  });

  it('defines all required room lifecycle events', () => {
    expect(WS_EVENTS.JOIN_ROOM).toBe('join-room');
    expect(WS_EVENTS.LEAVE_ROOM).toBe('leave-room');
  });

  it('defines all required element mutation events', () => {
    expect(WS_EVENTS.ELEMENT_CREATE).toBe('element-create');
    expect(WS_EVENTS.ELEMENT_UPDATE).toBe('element-update');
    expect(WS_EVENTS.ELEMENT_DELETE).toBe('element-delete');
  });

  it('defines cursor and presence events', () => {
    expect(WS_EVENTS.CURSOR_MOVE).toBe('cursor-move');
    expect(WS_EVENTS.USER_JOIN).toBe('user-join');
    expect(WS_EVENTS.USER_LEAVE).toBe('user-leave');
  });

  it('defines sync events', () => {
    expect(WS_EVENTS.ROOM_SNAPSHOT).toBe('room-snapshot');
    expect(WS_EVENTS.ROOM_RESYNC).toBe('room-resync');
  });

  it('defines ROOM_DIFF event for reconnect diff protocol (P3A-03 AC-12)', () => {
    // @covers AC-12
    expect(WS_EVENTS.ROOM_DIFF).toBe('room-diff');
  });

  it('has 12 distinct event values', () => {
    // P3A-03: ROOM_DIFF added (AC-12)
    const values = Object.values(WS_EVENTS);
    expect(values).toHaveLength(12);
    expect(new Set(values).size).toBe(12);
  });
});

describe('doesIncomingElementWin', () => {
  it('uses the shared whole-element LWW rule', () => {
    const current = makeElement({ version: 5, versionNonce: 500 });

    expect(doesIncomingElementWin(makeElement({ version: 6, versionNonce: 900 }), current)).toBe(
      true,
    );
    expect(doesIncomingElementWin(makeElement({ version: 4, versionNonce: 100 }), current)).toBe(
      false,
    );
    expect(doesIncomingElementWin(makeElement({ version: 5, versionNonce: 100 }), current)).toBe(
      true,
    );
    expect(doesIncomingElementWin(makeElement({ version: 5, versionNonce: 900 }), current)).toBe(
      false,
    );
  });
});
