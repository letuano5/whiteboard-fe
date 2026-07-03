const SYNC_COMMAND_KINDS = new Set([
  'create-element',
  'patch-slots',
  'reorder-elements',
  'update-arrow-binding',
  'delete-elements',
  'restore-elements',
  'replace-document',
]);

export function hasSyncCommandKind(value: Record<string, unknown>): boolean {
  return typeof value.kind === 'string' && SYNC_COMMAND_KINDS.has(value.kind);
}
