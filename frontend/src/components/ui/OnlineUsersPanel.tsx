import { useInteractionStore } from '../../store/interaction.store';
import { LOCAL_PRESENCE } from '../../sync/presence';
import { useRoomAccessStore } from '../../rooms/room-access.store';
import type { EffectiveRoomRole } from '../../types/shared';

export default function OnlineUsersPanel() {
  const remoteCursors = useInteractionStore((s) => s.remoteCursors);
  const baseRole = useRoomAccessStore((s) => s.baseRole);
  const role = useRoomAccessStore((s) => s.effectiveRole);
  const peers = [...remoteCursors.values()];
  const selfName = role === 'owner' ? 'Owner' : LOCAL_PRESENCE.name;

  return (
    <div className="flex max-h-[200px] flex-col gap-1 overflow-y-auto">
      {/* Local user — always shown first */}
      <UserBadge
        name={selfName}
        color={LOCAL_PRESENCE.color}
        baseRole={baseRole}
        role={role}
        isSelf
      />
      {/* Remote peers */}
      {peers.map((p) => (
        <UserBadge
          key={p.sessionId}
          name={p.name}
          color={p.color}
          baseRole={p.baseRole}
          role={p.effectiveRole}
        />
      ))}
    </div>
  );
}

function UserBadge({
  name,
  color,
  baseRole,
  role,
  isSelf,
}: {
  name: string;
  color: string;
  baseRole?: EffectiveRoomRole;
  role?: EffectiveRoomRole;
  isSelf?: boolean;
}) {
  const roleText = formatRole(role);
  const baseRoleText = baseRole && baseRole !== role ? `Base: ${formatRole(baseRole)}` : null;

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-rule bg-paper/90 px-2 py-0.5 text-xs">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className={`text-ink ${isSelf ? 'font-semibold' : 'font-normal'}`}>
        {name}
        {isSelf && <span className="ml-1 font-normal text-muted">(you)</span>}
      </span>
      {roleText && roleText !== name && (
        <span
          title={baseRoleText ?? undefined}
          className="rounded border border-rule px-1.5 py-px text-[11px] font-bold text-muted"
        >
          {roleText}
        </span>
      )}
    </div>
  );
}

function formatRole(role: EffectiveRoomRole | undefined): string | null {
  if (!role || role === 'none') return null;
  return role.charAt(0).toUpperCase() + role.slice(1);
}
