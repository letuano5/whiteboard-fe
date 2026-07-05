import type { ChangeEvent } from 'react';
import { Shield, Users } from 'lucide-react';
import type { RoomRole } from '../types/shared';
import { updateRoomMemberRole } from '../sync/socket-client';
import { useRoomAccessStore } from './room-access.store';

const ROLE_LABELS: Record<RoomRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

export default function RoomMembersPanel() {
  const role = useRoomAccessStore((state) => state.role);
  const members = useRoomAccessStore((state) => state.members);
  const errorMessage = useRoomAccessStore((state) => state.errorMessage);

  if (role !== 'owner') return null;

  function handleRoleChange(userId: string, event: ChangeEvent<HTMLSelectElement>) {
    const nextRole = event.target.value;
    if (nextRole !== 'editor' && nextRole !== 'viewer') return;
    updateRoomMemberRole(userId, nextRole);
  }

  return (
    <section
      aria-label="Room members"
      className="w-[260px] rounded-lg border border-rule bg-paper/95 p-2.5 text-ink shadow-md"
    >
      <div className="mb-2 flex items-center gap-2 text-[13px] font-bold">
        <Users size={16} />
        Members
      </div>
      <div className="flex flex-col gap-2">
        {members.map((member) => {
          const name = member.name ?? member.email ?? member.userId;
          const isOwner = member.role === 'owner';

          return (
            <div
              key={member.userId}
              className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs"
            >
              <div className="min-w-0">
                <div title={name} className="truncate font-semibold">
                  {name}
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1 text-muted">
                    <Shield size={12} />
                    Owner
                  </div>
                )}
              </div>
              {isOwner ? (
                <span className="text-xs text-muted">{ROLE_LABELS.owner}</span>
              ) : (
                <select
                  aria-label={`Role for ${name}`}
                  value={member.role}
                  onChange={(event) => handleRoleChange(member.userId, event)}
                  className="h-7 rounded-md border border-field-border bg-paper text-xs text-ink"
                >
                  <option value="editor">{ROLE_LABELS.editor}</option>
                  <option value="viewer">{ROLE_LABELS.viewer}</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
      {errorMessage && <div className="mt-2 text-xs text-danger">{errorMessage}</div>}
    </section>
  );
}
