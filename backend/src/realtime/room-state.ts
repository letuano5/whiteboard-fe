import type { Presence } from '@vdt/shared';

export interface RoomState {
  roomPresence: Map<string, Map<string, Presence>>;
}

export function createRoomState(): RoomState {
  return {
    roomPresence: new Map<string, Map<string, Presence>>(),
  };
}
