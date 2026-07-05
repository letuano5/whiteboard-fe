import { Trash2 } from 'lucide-react';
import type { RoomRole } from '../types/shared';
import { getInitials } from '../utils/initials';

type EditableRole = Extract<RoomRole, 'editor' | 'viewer'>;

interface MemberRowProps {
  identity: string;
  role: RoomRole;
  onRoleChange: (role: EditableRole) => void;
  onRemove: () => void;
}

export function MemberRow({ identity, role, onRoleChange, onRemove }: MemberRowProps) {
  const isOwner = role === 'owner';

  return (
    <div className="contents">
      <div className="flex h-7 w-7 items-center justify-center self-center rounded-full bg-primary-soft text-[11.5px] font-bold text-primary">
        {getInitials(identity)}
      </div>
      <div className="min-w-0 self-center">
        <span className="block truncate text-[13px] font-semibold">{identity}</span>
      </div>
      {isOwner ? (
        <span className="flex h-[30px] items-center justify-center self-center text-[11.5px] font-bold uppercase tracking-wide text-muted">
          Owner
        </span>
      ) : (
        <select
          aria-label={`Role for ${identity}`}
          value={role}
          onChange={(event) =>
            onRoleChange(event.target.value === 'editor' ? 'editor' : 'viewer')
          }
          className="h-[30px] w-full self-center rounded-md border border-field-border bg-paper px-2 text-xs font-semibold text-ink"
        >
          <option value="viewer">Can view</option>
          <option value="editor">Can edit</option>
        </select>
      )}
      {isOwner ? (
        <span className="h-[30px] w-8 self-center" />
      ) : (
        <button
          type="button"
          aria-label={`Remove ${identity}`}
          onClick={onRemove}
          className="flex h-[30px] w-8 items-center justify-center self-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
