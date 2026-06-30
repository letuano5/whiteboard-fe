import { useEffect, type RefObject } from 'react';
import { useCameraStore } from '../../store';
import { ZOOM_SENSITIVITY } from '../../utils/camera';
import { clientPointToLocalPoint } from '../pointer-coordinates';

function normalizeWheelDelta(delta: number, deltaMode: number, pageSize: number): number {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * pageSize;
  return delta;
}

export function useWheelPanZoom(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const wheelTarget = element;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = wheelTarget.getBoundingClientRect();
      const { camera, zoomTo, panBy } = useCameraStore.getState();
      const normX = normalizeWheelDelta(event.deltaX, event.deltaMode, rect.width);
      const normY = normalizeWheelDelta(event.deltaY, event.deltaMode, rect.height);

      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-normY * ZOOM_SENSITIVITY);
        zoomTo(camera.zoom * factor, clientPointToLocalPoint(event, rect));
        return;
      }

      panBy(normX / camera.zoom, normY / camera.zoom);
    }

    wheelTarget.addEventListener('wheel', handleWheel, { passive: false });
    return () => wheelTarget.removeEventListener('wheel', handleWheel);
  }, [containerRef]);
}
