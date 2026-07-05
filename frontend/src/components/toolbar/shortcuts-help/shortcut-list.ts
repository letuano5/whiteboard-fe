export interface ShortcutItem {
  keys: string;
  label: string;
}

export interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Selection',
    items: [
      { keys: 'Ctrl/Cmd+A', label: 'Select all' },
      { keys: 'Arrow keys', label: 'Move selection (hold Shift for larger steps)' },
      { keys: 'Shift + drag handle', label: 'Resize while locking aspect ratio' },
    ],
  },
  {
    title: 'Clipboard',
    items: [
      { keys: 'Ctrl/Cmd+C', label: 'Copy' },
      { keys: 'Ctrl/Cmd+X', label: 'Cut' },
      { keys: 'Ctrl/Cmd+V', label: 'Paste' },
      { keys: 'Ctrl/Cmd+D', label: 'Duplicate' },
    ],
  },
  {
    title: 'Editing',
    items: [
      { keys: 'Delete / Backspace', label: 'Delete selection' },
      { keys: 'Ctrl/Cmd+G', label: 'Merge' },
      { keys: 'Ctrl/Cmd+Shift+G', label: 'Unmerge' },
    ],
  },
  {
    title: 'History',
    items: [
      { keys: 'Ctrl/Cmd+Z', label: 'Undo' },
      { keys: 'Ctrl/Cmd+Shift+Z', label: 'Redo' },
    ],
  },
  {
    title: 'Help',
    items: [{ keys: '?', label: 'Toggle this panel' }],
  },
];
