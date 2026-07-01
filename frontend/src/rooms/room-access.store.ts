import { create } from 'zustand';
import type {
  EffectiveRoomRole,
  RoomAccessErrorPayload,
  RoomAccessMode,
  RoomAccessPayload,
  RoomInvitationSummary,
  RoomMemberSummary,
} from '../types/shared';

interface RoomAccessState {
  roomId: string | null;
  role: RoomAccessPayload['role'];
  baseRole: EffectiveRoomRole;
  effectiveRole: EffectiveRoomRole;
  visibility: RoomAccessMode;
  maxParticipants: number | null;
  maxEditors: number | null;
  shareRevokedAt: string | null;
  members: RoomMemberSummary[];
  invitations: RoomInvitationSummary[];
  errorCode: RoomAccessErrorPayload['code'] | null;
  errorMessage: string | null;
  setRoomAccess: (payload: RoomAccessInput) => void;
  setRoomAccessError: (payload: RoomAccessErrorPayload) => void;
  resetRoomAccess: () => void;
}

export const useRoomAccessStore = create<RoomAccessState>((set) => ({
  roomId: null,
  role: 'editor',
  baseRole: 'editor',
  effectiveRole: 'editor',
  visibility: 'private',
  maxParticipants: null,
  maxEditors: null,
  shareRevokedAt: null,
  members: [],
  invitations: [],
  errorCode: null,
  errorMessage: null,
  setRoomAccess: (payload) => {
    const normalized = normalizeRoomAccess(payload);
    set({
      roomId: normalized.roomId,
      role: normalized.role,
      baseRole: normalized.baseRole,
      effectiveRole: normalized.effectiveRole,
      visibility: normalized.visibility,
      maxParticipants: normalized.maxParticipants,
      maxEditors: normalized.maxEditors,
      shareRevokedAt: normalized.shareRevokedAt,
      members: normalized.members,
      invitations: normalized.invitations,
      errorCode: null,
      errorMessage: null,
    });
  },
  setRoomAccessError: (payload) => set({ errorCode: payload.code, errorMessage: payload.message }),
  resetRoomAccess: () =>
    set({
      roomId: null,
      role: 'editor',
      baseRole: 'editor',
      effectiveRole: 'editor',
      visibility: 'private',
      maxParticipants: null,
      maxEditors: null,
      shareRevokedAt: null,
      members: [],
      invitations: [],
      errorCode: null,
      errorMessage: null,
    }),
}));

export function canEditRoom(role: EffectiveRoomRole): boolean {
  return role === 'owner' || role === 'editor';
}

type RoomAccessInput =
  | RoomAccessPayload
  | PartialCapacityRoomAccessPayload
  | LegacyRoomAccessPayload;

type PartialCapacityRoomAccessPayload = Omit<RoomAccessPayload, 'maxParticipants' | 'maxEditors'> &
  Partial<Pick<RoomAccessPayload, 'maxParticipants' | 'maxEditors'>>;

interface LegacyRoomAccessPayload {
  roomId: string;
  role: RoomAccessPayload['role'];
  members: RoomMemberSummary[];
}

function normalizeRoomAccess(payload: RoomAccessInput): RoomAccessPayload {
  if ('effectiveRole' in payload) {
    return {
      ...payload,
      maxParticipants: payload.maxParticipants ?? null,
      maxEditors: payload.maxEditors ?? null,
    };
  }

  return {
    ...payload,
    baseRole: payload.role,
    effectiveRole: payload.role,
    visibility: 'private',
    maxParticipants: null,
    maxEditors: null,
    shareRevokedAt: null,
    invitations: [],
  };
}
