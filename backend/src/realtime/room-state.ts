import type { Element, Presence } from '@vdt/shared';

export interface RoomState {
  roomPresence: Map<string, Map<string, Presence>>;
  roomElements: Map<string, Map<string, Element>>;
  roomClocks: Map<string, number>;
}

export function createRoomState(): RoomState {
  return {
    roomPresence: new Map<string, Map<string, Presence>>(),
    roomElements: new Map<string, Map<string, Element>>(),
    roomClocks: new Map<string, number>(),
  };
}
