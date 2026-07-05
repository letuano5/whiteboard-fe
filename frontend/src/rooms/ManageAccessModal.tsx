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
import { CapacitySettings } from './CapacitySettings';
import { useRoomAccessStore } from './room-access.store';

type EditableRole = Extract<RoomRole, 'editor' | 'viewer'>;

interface ManageAccessModalProps {
  roomId: string;
  onClose: () => void;
}

const ACCESS_MODES: Array<{ value: RoomAccessMode; label: string }> = [
  { value: 'private', label: 'Private' },
  { value: 'link_view', label: 'Public viewer' },
  { value: 'link_edit', label: 'Public editor' },
];

const fieldClass = 'h-[34px] min-w-0 rounded-md border border-field-border px-2.5 text-ink';

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
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Share"
        className="max-h-[calc(100vh-48px)] w-[min(520px,calc(100vw-32px))] overflow-auto rounded-lg bg-paper p-[18px] text-ink shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-lg font-semibold">Share</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-rule bg-paper hover:bg-panel"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleInvite} className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <input
            aria-label="Add email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
            className={fieldClass}
          />
          <select
            aria-label="Invite role"
            value={role}
            onChange={(event) => setRole(event.target.value === 'editor' ? 'editor' : 'viewer')}
            className="h-[34px] rounded-md border border-field-border bg-paper text-ink"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            type="submit"
            className="h-[34px] rounded-md bg-primary px-3 text-paper hover:opacity-90"
          >
            Add
          </button>
        </form>

        <div className="mt-4 grid gap-2.5">
          {members.map((member) => {
            const name = member.name ?? member.email ?? member.userId;
            const isOwner = member.role === 'owner';
            return (
              <div
                key={member.userId}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-[13px]"
              >
                <span className="min-w-0 overflow-hidden text-ellipsis">{name}</span>
                {isOwner ? (
                  <span className="text-muted">Owner</span>
                ) : (
                  <>
                    <select
                      aria-label={`Role for ${name}`}
                      value={member.role}
                      onChange={(event) => {
                        const nextRole = event.target.value === 'editor' ? 'editor' : 'viewer';
                        void apply(updateRoomMemberRole(roomId, member.userId, nextRole));
                      }}
                      className="h-[34px] rounded-md border border-field-border bg-paper text-ink"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void apply(removeRoomMember(roomId, member.userId))}
                      className="h-8 rounded-md border border-field-border bg-paper px-2.5 text-ink hover:bg-panel"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <CapacitySettings roomId={roomId} />

        <section
          className="mt-[18px] grid gap-2.5 border-t border-rule pt-4"
          aria-label="Link access"
        >
          <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <Link2 size={16} />
            Link access
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {ACCESS_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                aria-pressed={visibility === mode.value}
                onClick={() => handleModeChange(mode.value)}
                className={`min-h-[34px] rounded-md border px-2 text-xs font-semibold ${
                  visibility === mode.value
                    ? 'border-primary bg-primary text-paper'
                    : 'border-field-border bg-paper text-ink hover:bg-panel'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-[34px] items-center justify-self-start gap-1.5 rounded-md border border-field-border bg-paper px-2.5 text-[13px] font-semibold text-ink hover:bg-panel"
          >
            <Copy size={15} />
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </section>

        <div className="mt-2.5 min-h-[18px]">
          {error && <div className="text-[13px] text-danger">{error}</div>}
        </div>
      </section>
    </div>
  );
}
