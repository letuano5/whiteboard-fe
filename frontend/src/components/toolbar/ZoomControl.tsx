import { useCameraStore } from '../../store/camera.store';

export default function ZoomControl() {
  const zoom = useCameraStore((s) => s.camera.zoom);
  const resetCamera = useCameraStore((s) => s.resetCamera);
  const pct = Math.round(zoom * 100);

  return (
    <button
      type="button"
      title="Reset zoom"
      aria-label={`Zoom ${pct}%, click to reset`}
      onClick={resetCamera}
      style={{
        minWidth: 40,
        height: 30,
        flexShrink: 0,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        background: 'transparent',
        color: '#374151',
        fontSize: 12,
        fontWeight: 500,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {pct}%
    </button>
  );
}
