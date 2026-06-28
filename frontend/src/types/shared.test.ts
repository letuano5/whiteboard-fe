import { describe, it, expect } from 'vitest';
import { WS_EVENTS } from './shared';

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

  it('has 11 distinct event values', () => {
    const values = Object.values(WS_EVENTS);
    expect(values).toHaveLength(11);
    expect(new Set(values).size).toBe(11);
  });
});
