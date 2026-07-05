import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Camera, Element } from '../../../types/shared';
import { useCameraStore } from '../../../store/camera.store';
import { useElementsStore } from '../../../store/elements.store';
import { useInteractionStore } from '../../../store/interaction.store';
import { useWhiteboardPointerHandlers } from '../use-whiteboard-pointer-handlers';
import { getPinchPoints, midpointAndDistance, setActivePointer } from '../multi-touch-gesture';

const CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

function TestSurface({
  tool = 'select',
  elements = [],
}: {
  tool?: Parameters<typeof useWhiteboardPointerHandlers>[0]['tool'];
  elements?: Element[];
}) {
  const { isPanning, svgLayerHandlers } = useWhiteboardPointerHandlers({
    canEdit: true,
    camera: CAMERA,
    editingId: null,
    elements,
    spaceDown: false,
    tool,
  });

  return (
    <svg data-panning={isPanning ? 'true' : 'false'} data-testid="surface" {...svgLayerHandlers} />
  );
}

beforeEach(() => {
  useCameraStore.getState().resetCamera();
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().reset();

  Object.defineProperty(SVGElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  });
});

describe('multi-touch gesture helpers', () => {
  it('@covers AC-5 (049-mobile-responsive-pan-zoom): computes midpoint and distance from the first two active pointers', () => {
    const pointers = new Map<number, { x: number; y: number }>();
    setActivePointer(pointers, 10, { x: 0, y: 0 });
    setActivePointer(pointers, 20, { x: 6, y: 8 });
    setActivePointer(pointers, 30, { x: 100, y: 100 });

    const points = getPinchPoints(pointers);

    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 8 },
    ]);
    expect(midpointAndDistance(points![0], points![1])).toEqual({
      midX: 3,
      midY: 4,
      dist: 10,
    });
  });
});

describe('useWhiteboardPointerHandlers multi-touch routing', () => {
  it('@covers AC-5 (049-mobile-responsive-pan-zoom): two active pointers pan by midpoint delta and zoom around the midpoint', () => {
    render(<TestSurface tool="select" />);
    const surface = screen.getByTestId('surface');
    const cameraState = useCameraStore.getState();
    const panSpy = vi.spyOn(cameraState, 'panBy');
    const zoomSpy = vi.spyOn(cameraState, 'zoomTo');

    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerDown(surface, { pointerId: 2, clientX: 200, clientY: 100, button: 0 });
    fireEvent.pointerMove(surface, { pointerId: 2, clientX: 220, clientY: 110, button: 0 });

    expect(surface).toHaveAttribute('data-panning', 'true');
    expect(panSpy).toHaveBeenCalledWith(-10, -5);
    expect(zoomSpy).toHaveBeenCalledWith(expect.closeTo(1.204159, 5), { x: 160, y: 105 });
  });

  it('@covers AC-6 (049-mobile-responsive-pan-zoom): adding a second pointer cancels a shape draft and suppresses the remaining pointer until full lift', () => {
    render(<TestSurface tool="rectangle" />);
    const surface = screen.getByTestId('surface');

    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    expect(useInteractionStore.getState().draftElement?.type).toBe('rectangle');

    fireEvent.pointerDown(surface, { pointerId: 2, clientX: 40, clientY: 10, button: 0 });
    expect(useInteractionStore.getState().draftElement).toBeNull();

    fireEvent.pointerUp(surface, { pointerId: 2, clientX: 40, clientY: 10, button: 0 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 30, clientY: 30, button: 0 });
    expect(useInteractionStore.getState().draftElement).toBeNull();

    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 30, clientY: 30, button: 0 });
    fireEvent.pointerDown(surface, { pointerId: 3, clientX: 50, clientY: 50, button: 0 });
    expect(useInteractionStore.getState().draftElement?.type).toBe('rectangle');
  });

  it('@covers AC-7 (049-mobile-responsive-pan-zoom): pointercancel discards a normal draft without committing an element', () => {
    render(<TestSurface tool="rectangle" />);
    const surface = screen.getByTestId('surface');

    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerCancel(surface, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });

    expect(useInteractionStore.getState().draftElement).toBeNull();
    expect(useElementsStore.getState().elements).toHaveLength(0);
  });
});
