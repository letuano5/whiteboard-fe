import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';
import type { RoomAccessMode, RoomRole } from '../types/shared';
import {
  inviteRoomUser,
  removeRoomMember,
  setRoomShareMode,
  updateRoomMemberRole,
} from './room-access-api';
import { CapacitySettings } from './CapacitySettings';
import { LinkAccessPanel } from './LinkAccessPanel';
import { MemberRow } from './MemberRow';
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  return createPortal(
    <div role="presentation" className="fixed inset-0 z-[10000] grid place-items-center bg-black/70">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Share"
        className="max-h-[calc(100vh-48px)] w-[min(460px,calc(100vw-32px))] overflow-auto rounded-[14px] bg-paper p-[18px] text-ink shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-[17px] font-semibold tracking-tight">Share board</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-muted hover:bg-panel hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <LinkAccessPanel visibility={visibility} onChange={handleModeChange} />

        <hr className="my-4 border-rule" />

        <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
          People with access
        </p>
        <form
          onSubmit={handleInvite}
          className="flex h-9 items-stretch overflow-hidden rounded-lg border border-field-border bg-paper"
        >
          <input
            aria-label="Add email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
            className="min-w-0 flex-1 border-0 bg-transparent px-2.5 text-[13px] text-ink outline-none placeholder:text-muted"
          />
          <select
            aria-label="Invite role"
            value={role}
            onChange={(event) => setRole(event.target.value === 'editor' ? 'editor' : 'viewer')}
            className="shrink-0 border-l border-field-border bg-transparent px-2 text-[12.5px] font-semibold text-ink outline-none"
          >
            <option value="viewer">Can view</option>
            <option value="editor">Can edit</option>
          </select>
          <button
            type="submit"
            className="shrink-0 border-l border-primary bg-primary px-3 text-[13px] font-semibold text-paper hover:opacity-90"
          >
            Invite
          </button>
        </form>

        <div className="mt-3.5 grid grid-cols-[28px_minmax(0,1fr)_92px_32px] gap-x-2.5 gap-y-2.5">
          {members.map((member) => {
            const identity = member.email ?? member.name ?? member.userId;
            return (
              <MemberRow
                key={member.userId}
                identity={identity}
                role={member.role}
                onRoleChange={(nextRole) =>
                  void apply(updateRoomMemberRole(roomId, member.userId, nextRole))
                }
                onRemove={() => void apply(removeRoomMember(roomId, member.userId))}
              />
            );
          })}
        </div>

        <hr className="my-4 border-rule" />

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-[12.5px] font-semibold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
            Set participant limits
          </summary>
          <CapacitySettings roomId={roomId} />
        </details>

        <div className="mt-2.5 min-h-[18px]">
          {error && (
            <div className="rounded-lg border border-danger-border bg-danger-soft px-2.5 py-2 text-[12.5px] text-danger">
              {error}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
