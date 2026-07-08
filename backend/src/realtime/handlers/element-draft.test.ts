import type { Socket } from 'socket.io';
import { WS_EVENTS } from '@vdt/shared';
import { describe, expect, it, vi } from 'vitest';
import { makeElement } from '../../test/element-fixtures.js';
import { handleElementDraft } from './element-draft.js';

describe('handleElementDraft', () => {
  it('relays draft elements to the joined room', () => {
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    const socket = {
      data: { roomId: 'room-1', sessionId: 'joined-session' },
      to,
    } as unknown as Socket;
    const draft = makeElement({ id: 'el-1' });

    handleElementDraft(socket, {
      roomId: 'room-1',
      sessionId: 'spoofed-session',
      elements: [draft],
    });

    expect(to).toHaveBeenCalledWith('room-1');
    expect(emit).toHaveBeenCalledWith(
      WS_EVENTS.ELEMENT_DRAFT,
      expect.objectContaining({ sessionId: 'joined-session', elements: [draft] }),
    );
  });

  it('drops drafts for a room the socket has not joined', () => {
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    const socket = { data: { roomId: 'room-1' }, to } as unknown as Socket;
    const draft = makeElement({ id: 'el-1' });

    handleElementDraft(socket, { roomId: 'room-2', sessionId: 'session-1', elements: [draft] });

    expect(to).not.toHaveBeenCalled();
  });

  it('drops drafts before the socket has a joined session', () => {
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    const socket = { data: { roomId: 'room-1' }, to } as unknown as Socket;
    const draft = makeElement({ id: 'el-1' });

    handleElementDraft(socket, { roomId: 'room-1', sessionId: 'session-1', elements: [draft] });

    expect(to).not.toHaveBeenCalled();
  });
});
