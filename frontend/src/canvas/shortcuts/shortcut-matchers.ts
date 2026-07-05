export interface KeyboardShortcutInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export function isModifierPressed(event: KeyboardShortcutInput): boolean {
  return event.ctrlKey === true || event.metaKey === true;
}

export function isCopyShortcut(event: KeyboardShortcutInput): boolean {
  return isModifierPressed(event) && event.key === 'c';
}

export function isPasteShortcut(event: KeyboardShortcutInput): boolean {
  return isModifierPressed(event) && event.key === 'v';
}

export function isDuplicateShortcut(event: KeyboardShortcutInput): boolean {
  return isModifierPressed(event) && event.key === 'd';
}

export function isMergeShortcut(event: KeyboardShortcutInput): boolean {
  return isModifierPressed(event) && event.key === 'g' && !event.shiftKey;
}

export function isUnmergeShortcut(event: KeyboardShortcutInput): boolean {
  return isModifierPressed(event) && event.key === 'g' && event.shiftKey === true;
}

export function isDeleteShortcut(event: KeyboardShortcutInput): boolean {
  return event.key === 'Delete' || event.key === 'Backspace';
}

export function isSelectAllShortcut(event: KeyboardShortcutInput): boolean {
  return isModifierPressed(event) && event.key === 'a';
}

export function isCutShortcut(event: KeyboardShortcutInput): boolean {
  return isModifierPressed(event) && event.key === 'x';
}

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function isArrowMoveShortcut(event: KeyboardShortcutInput): boolean {
  return ARROW_KEYS.has(event.key) && !isModifierPressed(event);
}

export function isUndoShortcut(event: KeyboardShortcutInput): boolean {
  return isModifierPressed(event) && event.key === 'z' && !event.shiftKey;
}

export function isRedoShortcut(event: KeyboardShortcutInput): boolean {
  return isModifierPressed(event) && event.key === 'z' && event.shiftKey === true;
}
