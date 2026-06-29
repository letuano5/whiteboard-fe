import { useInteractionStore } from '../../store/interaction.store';
import { LOCAL_PRESENCE } from '../../sync/presence';

export default function OnlineUsersPanel() {
  const remoteCursors = useInteractionStore((s) => s.remoteCursors);
  const peers = [...remoteCursors.values()];

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
      <UserBadge name={LOCAL_PRESENCE.name} color={LOCAL_PRESENCE.color} isSelf />
      {/* Remote peers */}
      {peers.map((p) => (
        <UserBadge key={p.sessionId} name={p.name} color={p.color} />
      ))}
    </div>
  );
}

function UserBadge({
  name,
  color,
  isSelf,
}: {
  name: string;
  color: string;
  isSelf?: boolean;
}) {
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
        {isSelf && (
          <span style={{ color: '#999', fontWeight: 400, marginLeft: 4 }}>(you)</span>
        )}
      </span>
    </div>
  );
}
