import type React from 'react';
import { useEffect, useState } from 'react';
import { useElementsStore } from '../../store/elements.store';
import { useCameraStore } from '../../store/camera.store';
import { isAnyElementVisible, fitToContent, getContentBounds } from '../../utils/camera';

interface BackToContentProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const TOOLBAR_BOTTOM_PX = 16;
const TOOLBAR_HEIGHT_PX = 50;
const TOOLBAR_GAP_PX = 8;
const BACK_TO_CONTENT_BOTTOM_PX = TOOLBAR_BOTTOM_PX + TOOLBAR_HEIGHT_PX + TOOLBAR_GAP_PX;

export default function BackToContent({ containerRef }: BackToContentProps) {
  const elements = useElementsStore((s) => s.elements);
  const camera = useCameraStore((s) => s.camera);

  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewportSize({ w: width, h: height });
    });
    obs.observe(el);
    const rect = el.getBoundingClientRect();
    setViewportSize({ w: rect.width, h: rect.height });
    return () => obs.disconnect();
  }, [containerRef]);

  const { w: viewportW, h: viewportH } = viewportSize;
  const hasContent = getContentBounds(elements) !== null;
  const anyVisible = isAnyElementVisible(elements, camera, viewportW, viewportH);
  const showButton = hasContent && !anyVisible;

  if (!showButton) return null;

  function handleClick() {
    const el = containerRef.current;
    const w = el?.getBoundingClientRect().width ?? viewportW;
    const h = el?.getBoundingClientRect().height ?? viewportH;
    const newCamera = fitToContent(elements, camera, w, h);
    useCameraStore.getState().setCamera(newCamera);
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: `${BACK_TO_CONTENT_BOTTOM_PX}px`,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
      }}
    >
      <button
        onClick={handleClick}
        aria-label="Back to content"
        style={{
          padding: '6px 14px',
          borderRadius: '6px',
          border: '1px solid #ccc',
          background: '#fff',
          cursor: 'pointer',
          fontSize: '13px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          whiteSpace: 'nowrap',
        }}
      >
        Back to content
      </button>
    </div>
  );
}
