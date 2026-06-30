import { create } from 'zustand';
import type { RoomAccessErrorPayload, RoomAccessPayload, RoomMemberSummary } from '../types/shared';

interface RoomAccessState {
  roomId: string | null;
  role: RoomAccessPayload['role'];
  members: RoomMemberSummary[];
  errorMessage: string | null;
  setRoomAccess: (payload: RoomAccessPayload) => void;
  setRoomAccessError: (payload: RoomAccessErrorPayload) => void;
  resetRoomAccess: () => void;
}

export const useRoomAccessStore = create<RoomAccessState>((set) => ({
  roomId: null,
  role: 'editor',
  members: [],
  errorMessage: null,
  setRoomAccess: (payload) =>
    set({
      roomId: payload.roomId,
      role: payload.role,
      members: payload.members,
      errorMessage: null,
    }),
  setRoomAccessError: (payload) => set({ errorMessage: payload.message }),
  resetRoomAccess: () =>
    set({
      roomId: null,
      role: 'editor',
      members: [],
      errorMessage: null,
    }),
}));

export function canEditRoom(role: RoomAccessPayload['role']): boolean {
  return role === 'owner' || role === 'editor';
}
