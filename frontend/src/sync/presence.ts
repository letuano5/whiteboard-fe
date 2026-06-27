import type { Presence } from '../types/shared';

const IDENTITY_KEY = 'VDT_USER_IDENTITY';

const NAMES = [
  'Blue Fox',
  'Red Bear',
  'Green Wolf',
  'Purple Hawk',
  'Orange Tiger',
  'Teal Owl',
  'Pink Lynx',
  'Yellow Eagle',
  'Cyan Shark',
  'Lime Panther',
];

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#a855f7', // purple
  '#f97316', // orange
  '#14b8a6', // teal
  '#ec4899', // pink
  '#eab308', // yellow
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export interface LocalPresence {
  sessionId: string;
  name: string;
  color: string;
}

function loadOrCreate(): LocalPresence {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        typeof (parsed as Record<string, unknown>).sessionId === 'string' &&
        typeof (parsed as Record<string, unknown>).name === 'string' &&
        typeof (parsed as Record<string, unknown>).color === 'string'
      ) {
        return parsed as LocalPresence;
      }
    }
  } catch {
    // corrupted storage — fall through to generate new identity
  }

  const idx = Math.floor(Math.random() * NAMES.length);
  const identity: LocalPresence = {
    sessionId: crypto.randomUUID(),
    name: NAMES[idx],
    color: COLORS[idx],
  };

  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // QuotaExceededError — identity lives in memory only
  }

  return identity;
}

export const LOCAL_PRESENCE: LocalPresence = loadOrCreate();

export function toPresence(local: LocalPresence): Presence {
  return {
    sessionId: local.sessionId,
    name: local.name,
    color: local.color,
    cursor: null,
    selectedIds: [],
    status: 'active',
  };
}
