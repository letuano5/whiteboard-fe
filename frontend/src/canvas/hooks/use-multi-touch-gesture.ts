import { useRef } from 'react';
import type React from 'react';
import { useCameraStore } from '../../store';
import { clientPointToLocalPoint } from '../pointer-coordinates';
import {
  getPinchSnapshot,
  setActivePointer,
  type PinchSnapshot,
  type TouchPoint,
} from './multi-touch-gesture';

interface UseMultiTouchGestureParams {
  onGestureStart: (event: React.PointerEvent<SVGSVGElement>) => void;
  setIsPanning: (value: boolean) => void;
}

export function useMultiTouchGesture({ onGestureStart, setIsPanning }: UseMultiTouchGestureParams) {
  const activePointers = useRef<Map<number, TouchPoint>>(new Map());
  const pinchState = useRef<PinchSnapshot | null>(null);
  const gestureSuppressedPointers = useRef<Set<number>>(new Set());

  function suppressPointer(event: React.PointerEvent<SVGSVGElement>) {
    gestureSuppressedPointers.current.add(event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function releaseGesturePointer(pointerId: number): boolean {
    const wasGesturePointer =
      pinchState.current !== null || gestureSuppressedPointers.current.has(pointerId);

    activePointers.current.delete(pointerId);
    gestureSuppressedPointers.current.delete(pointerId);

    if (activePointers.current.size < 2) {
      pinchState.current = null;
    }

    if (activePointers.current.size === 0) {
      gestureSuppressedPointers.current.clear();
      setIsPanning(false);
    }

    return wasGesturePointer;
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>): boolean {
    setActivePointer(activePointers.current, event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (gestureSuppressedPointers.current.size > 0) {
      suppressPointer(event);
      return true;
    }

    if (activePointers.current.size === 2) {
      onGestureStart(event);
      const snapshot = getPinchSnapshot(activePointers.current);
      if (!snapshot) return false;

      pinchState.current = snapshot;
      gestureSuppressedPointers.current = new Set(activePointers.current.keys());
      setIsPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    if (activePointers.current.size > 2) {
      suppressPointer(event);
      return true;
    }

    return false;
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>): boolean {
    if (activePointers.current.has(event.pointerId)) {
      setActivePointer(activePointers.current, event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (pinchState.current && activePointers.current.size >= 2) {
      const next = getPinchSnapshot(activePointers.current);
      if (!next) return true;

      const prev = pinchState.current;
      const { camera, zoomTo, panBy } = useCameraStore.getState();
      const dx = next.midX - prev.midX;
      const dy = next.midY - prev.midY;

      if (dx !== 0 || dy !== 0) {
        panBy(-dx / camera.zoom, -dy / camera.zoom);
      }

      if (prev.dist > 0 && next.dist > 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        const pivot = clientPointToLocalPoint({ clientX: next.midX, clientY: next.midY }, rect);
        zoomTo(camera.zoom * (next.dist / prev.dist), pivot);
      }

      pinchState.current = next;
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    if (gestureSuppressedPointers.current.has(event.pointerId)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    return false;
  }

  function handlePointerEnd(event: React.PointerEvent<SVGSVGElement>): boolean {
    if (!releaseGesturePointer(event.pointerId)) return false;

    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
  };
}
