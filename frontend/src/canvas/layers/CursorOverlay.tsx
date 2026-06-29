import { useInteractionStore } from '../../store/interaction.store';
import { useCameraStore } from '../../store/camera.store';
import { worldToScreen } from '../../utils/camera';

export default function CursorOverlay() {
  const remoteCursors = useInteractionStore((s) => s.remoteCursors);
  const camera = useCameraStore((s) => s.camera);

  if (remoteCursors.size === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      {[...remoteCursors.values()].map((presence) => {
        if (!presence.cursor) return null;
        const screen = worldToScreen(presence.cursor.x, presence.cursor.y, camera);
        return (
          <div
            key={presence.sessionId}
            style={{
              position: 'absolute',
              left: screen.x,
              top: screen.y,
              transform: 'translate(2px, 2px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            {/* Cursor arrow */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 2L7 14L9.5 9.5L14 7L2 2Z"
                fill={presence.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <span
              style={{
                backgroundColor: presence.color,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                lineHeight: '16px',
                userSelect: 'none',
              }}
            >
              {presence.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
