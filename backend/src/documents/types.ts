export type DocumentStatusFilter = 'all' | 'shared' | 'locked';

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
}

export interface DocumentDashboardResponse {
  owned: DashboardDocument[];
  sharedWithMe: DashboardDocument[];
  recent: DashboardDocument[];
}

export interface DashboardListFilters {
  search?: string;
  includeArchived?: boolean;
  status?: DocumentStatusFilter;
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
