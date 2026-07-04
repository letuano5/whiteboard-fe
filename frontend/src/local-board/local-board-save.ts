import type { Camera, Element } from '../types/shared';
import { authenticatedFetch } from '../auth/authenticated-fetch';

const SERVER_URL = import.meta.env?.VITE_BACKEND_URL ?? '';

export interface SaveLocalBoardInput {
  elements: Element[];
  camera: Camera;
}

export interface SaveLocalBoardResult {
  roomId: string;
}

export async function saveLocalBoard(input: SaveLocalBoardInput): Promise<SaveLocalBoardResult> {
  const response = await authenticatedFetch(`${SERVER_URL}/api/rooms/from-local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body: unknown = await response.json();
  if (!isSaveLocalBoardResult(body)) {
    throw new Error('Saved document response was invalid.');
  }

  return body;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isErrorResponse(body)) {
      return body.error.message;
    }
  } catch {
    // Fall back to status text below.
  }

  return response.statusText || 'Could not save this board.';
}

function isSaveLocalBoardResult(value: unknown): value is SaveLocalBoardResult {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>).roomId === 'string';
}

function isErrorResponse(value: unknown): value is { error: { message: string } } {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null) return false;
  return typeof (error as Record<string, unknown>).message === 'string';
}
