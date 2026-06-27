import type { Presence } from '../types/shared';

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

function pick(): LocalPresence {
  const idx = Math.floor(Math.random() * NAMES.length);
  return {
    sessionId: crypto.randomUUID(),
    name: NAMES[idx],
    color: COLORS[idx],
  };
}

export const LOCAL_PRESENCE: LocalPresence = pick();

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
