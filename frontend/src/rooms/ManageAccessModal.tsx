import type { FormEvent } from 'react';
import { useState } from 'react';
import { X } from 'lucide-react';
import type { RoomRole } from '../types/shared';
import {
  inviteRoomUser,
  removeRoomMember,
  revokeRoomInvitation,
  updateRoomMemberRole,
} from './room-access-api';
import { useRoomAccessStore } from './room-access.store';

type EditableRole = Extract<RoomRole, 'editor' | 'viewer'>;

interface ManageAccessModalProps {
  roomId: string;
  onClose: () => void;
}

export function ManageAccessModal({ roomId, onClose }: ManageAccessModalProps) {
  const members = useRoomAccessStore((state) => state.members);
  const invitations = useRoomAccessStore((state) => state.invitations);
  const setRoomAccess = useRoomAccessStore((state) => state.setRoomAccess);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EditableRole>('viewer');
  const [error, setError] = useState<string | null>(null);

  async function apply(action: Promise<Parameters<typeof setRoomAccess>[0]>) {
    try {
      setError(null);
      setRoomAccess(await action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access update failed.');
    }
  }

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    void apply(inviteRoomUser(roomId, email, role)).then(() => setEmail(''));
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(15, 23, 42, 0.62)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Manage access"
        style={{
          width: 'min(520px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'auto',
          borderRadius: 8,
          background: '#fff',
          boxShadow: '0 24px 80px rgba(15,23,42,0.28)',
          padding: 18,
          color: '#18231d',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Manage access</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={iconButtonStyle}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input
            aria-label="Invite email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
            style={inputStyle}
          />
          <select
            aria-label="Invite role"
            value={role}
            onChange={(event) => setRole(event.target.value === 'editor' ? 'editor' : 'viewer')}
            style={selectStyle}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button type="submit" style={primaryButtonStyle}>
            Invite
          </button>
        </form>

        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          {members.map((member) => {
            const name = member.name ?? member.email ?? member.userId;
            const isOwner = member.role === 'owner';
            return (
              <div key={member.userId} style={rowStyle}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                </span>
                {isOwner ? (
                  <span>Owner</span>
                ) : (
                  <>
                    <select
                      aria-label={`Role for ${name}`}
                      value={member.role}
                      onChange={(event) => {
                        const nextRole = event.target.value === 'editor' ? 'editor' : 'viewer';
                        void apply(updateRoomMemberRole(roomId, member.userId, nextRole));
                      }}
                      style={selectStyle}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void apply(removeRoomMember(roomId, member.userId))}
                      style={secondaryButtonStyle}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {invitations.map((invite) => (
            <div key={invite.id} style={rowStyle}>
              <span>{invite.email}</span>
              <span>Pending {invite.role}</span>
              <button
                type="button"
                onClick={() => void apply(revokeRoomInvitation(roomId, invite.id))}
                style={secondaryButtonStyle}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>

        {error && <div style={{ marginTop: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>}
      </section>
    </div>
  );
}

const iconButtonStyle = {
  width: 34,
  height: 34,
  display: 'grid',
  placeItems: 'center',
  border: '1px solid #d7dfd8',
  borderRadius: 8,
  background: '#fff',
  cursor: 'pointer',
} satisfies React.CSSProperties;

const inputStyle = {
  minWidth: 0,
  flex: 1,
  height: 34,
  border: '1px solid #c8d2ca',
  borderRadius: 6,
  padding: '0 10px',
} satisfies React.CSSProperties;

const selectStyle = {
  height: 34,
  border: '1px solid #c8d2ca',
  borderRadius: 6,
  background: '#fff',
} satisfies React.CSSProperties;

const primaryButtonStyle = {
  height: 34,
  border: 'none',
  borderRadius: 6,
  background: '#2563eb',
  color: '#fff',
  padding: '0 12px',
  cursor: 'pointer',
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  height: 32,
  border: '1px solid #c8d2ca',
  borderRadius: 6,
  background: '#fff',
  padding: '0 10px',
  cursor: 'pointer',
} satisfies React.CSSProperties;

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
} satisfies React.CSSProperties;
