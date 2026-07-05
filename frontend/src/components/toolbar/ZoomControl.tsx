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
      className="flex h-[30px] min-w-[40px] shrink-0 items-center justify-center rounded-md px-2 text-xs font-medium text-ink transition-colors hover:bg-panel"
    >
      {pct}%
    </button>
  );
}
