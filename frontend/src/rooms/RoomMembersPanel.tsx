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
      style={{
        width: 260,
        border: '1px solid #d7dfd8',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.96)',
        boxShadow: '0 8px 24px rgba(24,35,29,0.12)',
        padding: 10,
        color: '#18231d',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        <Users size={16} />
        Members
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {members.map((member) => {
          const name = member.name ?? member.email ?? member.userId;
          const isOwner = member.role === 'owner';

          return (
            <div
              key={member.userId}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  title={name}
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}
                >
                  {name}
                </div>
                {isOwner && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#516158' }}>
                    <Shield size={12} />
                    Owner
                  </div>
                )}
              </div>
              {isOwner ? (
                <span style={{ color: '#516158', fontSize: 12 }}>{ROLE_LABELS.owner}</span>
              ) : (
                <select
                  aria-label={`Role for ${name}`}
                  value={member.role}
                  onChange={(event) => handleRoleChange(member.userId, event)}
                  style={{
                    height: 28,
                    border: '1px solid #c8d2ca',
                    borderRadius: 6,
                    background: '#fff',
                    fontSize: 12,
                  }}
                >
                  <option value="editor">{ROLE_LABELS.editor}</option>
                  <option value="viewer">{ROLE_LABELS.viewer}</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
      {errorMessage && (
        <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 12 }}>{errorMessage}</div>
      )}
    </section>
  );
}
