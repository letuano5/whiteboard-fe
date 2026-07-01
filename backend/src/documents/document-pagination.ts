const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 30;

export function clampPageSize(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit)));
}

export function encodeDashboardCursor(updatedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ updatedAt: updatedAt.toISOString(), id }), 'utf8').toString(
    'base64url',
  );
}

export function decodeDashboardCursor(cursor: string): { updatedAt: Date; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const value = parsed as Record<string, unknown>;
    if (typeof value.updatedAt !== 'string' || typeof value.id !== 'string') return null;
    const updatedAt = new Date(value.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) return null;
    return { updatedAt, id: value.id };
  } catch {
    return null;
  }
}
