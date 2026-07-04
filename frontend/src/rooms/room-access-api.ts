import type { RoomAccessMode, RoomAccessPayload, RoomRole } from '../types/shared';
import { authenticatedFetch } from '../auth/authenticated-fetch';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? '';

type EditableRole = Extract<RoomRole, 'editor' | 'viewer'>;

export async function fetchRoomAccess(roomId: string): Promise<RoomAccessPayload> {
  return readRoomAccessResponse(
    await authenticatedFetch(`${SERVER_URL}/api/rooms/${roomId}/access`),
  );
}

export async function setRoomShareMode(
  roomId: string,
  mode: RoomAccessMode,
): Promise<RoomAccessPayload> {
  return readRoomAccessResponse(
    await authenticatedFetch(`${SERVER_URL}/api/rooms/${roomId}/share`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    }),
  );
}

export async function revokeRoomShareLink(roomId: string): Promise<RoomAccessPayload> {
  return readRoomAccessResponse(
    await authenticatedFetch(`${SERVER_URL}/api/rooms/${roomId}/share`, { method: 'DELETE' }),
  );
}

export interface RoomCapacitySettingsInput {
  maxParticipants?: number | null;
  maxEditors?: number | null;
}

export async function updateRoomCapacitySettings(
  roomId: string,
  input: RoomCapacitySettingsInput,
): Promise<RoomAccessPayload> {
  return readRoomAccessResponse(
    await authenticatedFetch(`${SERVER_URL}/api/rooms/${roomId}/capacity`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

export async function inviteRoomUser(
  roomId: string,
  email: string,
  role: EditableRole,
): Promise<RoomAccessPayload> {
  return readRoomAccessResponse(
    await authenticatedFetch(`${SERVER_URL}/api/rooms/${roomId}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    }),
  );
}

export async function updateRoomMemberRole(
  roomId: string,
  userId: string,
  role: EditableRole,
): Promise<RoomAccessPayload> {
  return readRoomAccessResponse(
    await authenticatedFetch(`${SERVER_URL}/api/rooms/${roomId}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }),
  );
}

export async function removeRoomMember(roomId: string, userId: string): Promise<RoomAccessPayload> {
  return readRoomAccessResponse(
    await authenticatedFetch(`${SERVER_URL}/api/rooms/${roomId}/members/${userId}`, {
      method: 'DELETE',
    }),
  );
}

export async function revokeRoomInvitation(
  roomId: string,
  invitationId: string,
): Promise<RoomAccessPayload> {
  return readRoomAccessResponse(
    await authenticatedFetch(`${SERVER_URL}/api/rooms/${roomId}/invitations/${invitationId}`, {
      method: 'DELETE',
    }),
  );
}

async function readRoomAccessResponse(response: Response): Promise<RoomAccessPayload> {
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
        ? (payload as { error: { message: string } }).error.message
        : 'Room access request failed.';
    throw new Error(message);
  }

  return payload as RoomAccessPayload;
}
