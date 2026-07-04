import type { Element } from '@vdt/shared';

export type DocumentScopeFilter = 'all' | 'owned' | 'shared';

export interface DashboardDocument {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  role: string;
  visibility: string;
  locked: boolean;
  archivedAt: string | null;
  updatedAt: string;
  lastOpenedAt: string | null;
  previewElements: Element[];
}

export interface DocumentDashboardResponse {
  documents: DashboardDocument[];
  nextCursor: string | null;
}

export interface DashboardListFilters {
  search?: string;
  scope?: DocumentScopeFilter;
  cursor?: string;
  limit?: number;
}

export interface RoomForDashboard {
  id: string;
  name: string;
  ownerId: string | null;
  owner: { name: string | null; email: string | null } | null;
  visibility: string;
  locked: boolean;
  archivedAt: Date | null;
  updatedAt: Date;
  members: { role: string; lastOpenedAt: Date | null }[];
  records: { state: unknown }[];
}

export interface DocumentErrorResponse {
  error: {
    code:
      | 'documents/invalid-payload'
      | 'documents/not-found'
      | 'documents/forbidden'
      | 'documents/unauthenticated';
    message: string;
  };
}
