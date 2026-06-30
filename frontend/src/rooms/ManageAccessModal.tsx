import type { FormEvent } from 'react';
import { useState } from 'react';
import { Copy, Link2, X } from 'lucide-react';
import type { RoomAccessMode, RoomRole } from '../types/shared';
import {
  inviteRoomUser,
  removeRoomMember,
  setRoomShareMode,
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
  const visibility = useRoomAccessStore((state) => state.visibility);
  const setRoomAccess = useRoomAccessStore((state) => state.setRoomAccess);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EditableRole>('viewer');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  function handleModeChange(mode: RoomAccessMode) {
    if (mode === visibility) return;
    void apply(setRoomShareMode(roomId, mode));
  }

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        window.prompt('Copy this link:', window.location.href);
      },
    );
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
        aria-label="Share"
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
          <h2 style={{ margin: 0, fontSize: 18 }}>Share</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={iconButtonStyle}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleInvite} style={inviteFormStyle}>
          <input
            aria-label="Add email"
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
            Add
          </button>
        </form>

        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
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
        </div>

        <section style={linkSectionStyle} aria-label="Link access">
          <div style={sectionHeaderStyle}>
            <Link2 size={16} />
            Link access
          </div>
          <div style={modeGridStyle}>
            {ACCESS_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                aria-pressed={visibility === mode.value}
                onClick={() => handleModeChange(mode.value)}
                style={visibility === mode.value ? activeModeButtonStyle : modeButtonStyle}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={handleCopy} style={copyButtonStyle}>
            <Copy size={15} />
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </section>

        <div style={errorSlotStyle}>
          {error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div>}
        </div>
      </section>
    </div>
  );
}

const ACCESS_MODES: Array<{ value: RoomAccessMode; label: string }> = [
  { value: 'private', label: 'Private' },
  { value: 'link_view', label: 'Public viewer' },
  { value: 'link_edit', label: 'Public editor' },
];

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

const inviteFormStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  gap: 8,
  marginTop: 16,
} satisfies React.CSSProperties;

const inputStyle = {
  minWidth: 0,
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

const linkSectionStyle = {
  display: 'grid',
  gap: 10,
  marginTop: 18,
  paddingTop: 16,
  borderTop: '1px solid #e4ebe5',
} satisfies React.CSSProperties;

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
} satisfies React.CSSProperties;

const modeGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
} satisfies React.CSSProperties;

const modeButtonStyle = {
  minHeight: 34,
  border: '1px solid #c8d2ca',
  borderRadius: 6,
  background: '#fff',
  color: '#26352c',
  padding: '0 8px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
} satisfies React.CSSProperties;

const activeModeButtonStyle = {
  ...modeButtonStyle,
  border: '1px solid #047857',
  background: '#ecfdf5',
  color: '#065f46',
} satisfies React.CSSProperties;

const copyButtonStyle = {
  height: 34,
  justifySelf: 'start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid #c8d2ca',
  borderRadius: 6,
  background: '#fff',
  color: '#26352c',
  padding: '0 10px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
} satisfies React.CSSProperties;

const errorSlotStyle = {
  minHeight: 18,
  marginTop: 10,
} satisfies React.CSSProperties;
