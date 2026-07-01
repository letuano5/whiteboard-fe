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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxHeight: 200,
        overflowY: 'auto',
      }}
    >
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 6,
        padding: '3px 8px',
        fontSize: 12,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <span style={{ color: '#333', fontWeight: isSelf ? 600 : 400 }}>
        {name}
        {isSelf && <span style={{ color: '#999', fontWeight: 400, marginLeft: 4 }}>(you)</span>}
      </span>
      {roleText && roleText !== name && (
        <span
          title={baseRoleText ?? undefined}
          style={{
            border: '1px solid #d7dfd8',
            borderRadius: 4,
            padding: '1px 5px',
            color: '#47564d',
            fontSize: 11,
            fontWeight: 700,
          }}
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
