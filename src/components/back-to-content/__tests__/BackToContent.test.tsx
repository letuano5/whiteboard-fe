// @covers AC-1 AC-2 AC-3 AC-4 AC-5 (007-back-to-content-trackpad)
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BackToContent from '../BackToContent';
import { useElementsStore } from '../../../store/elements.store';
import { useCameraStore } from '../../../store/camera.store';
import type { Element } from '../../../types/shared';

function makeEl(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  deleted = false,
): Element {
  return {
    id,
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    zIndex: 1,
    isDeleted: deleted,
    props: {
      strokeColor: '#000',
      fillColor: '#fff',
      strokeWidth: 1,
      strokeStyle: 'solid',
      opacity: 1,
    },
    version: 1,
    versionNonce: 0,
    updatedAt: 0,
    groupId: null,
    frameId: null,
    locked: false,
    createdBy: 'test',
  };
}

const VIEWPORT_W = 800;
const VIEWPORT_H = 600;

function makeContainerRef() {
  return {
    current: {
      getBoundingClientRect: vi.fn().mockReturnValue({
        width: VIEWPORT_W,
        height: VIEWPORT_H,
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: VIEWPORT_W,
        bottom: VIEWPORT_H,
        toJSON: vi.fn(),
      }),
    } as unknown as HTMLDivElement,
  };
}

beforeEach(() => {
  useElementsStore.getState().setElements([]);
  useCameraStore.getState().resetCamera();
});

// @covers AC-3
describe('AC-3 (007): button hidden when canvas is empty', () => {
  it('renders no button when elements array is empty', () => {
    useElementsStore.getState().setElements([]);
    render(<BackToContent containerRef={makeContainerRef()} />);
    expect(screen.queryByRole('button', { name: /back to content/i })).toBeNull();
  });
});

// @covers AC-5
describe('AC-5 (007): soft-deleted elements do not count as content', () => {
  it('renders no button when all elements are isDeleted=true', () => {
    useElementsStore.getState().setElements([makeEl('a', 0, 0, 100, 100, true)]);
    render(<BackToContent containerRef={makeContainerRef()} />);
    expect(screen.queryByRole('button', { name: /back to content/i })).toBeNull();
  });
});

// @covers AC-2
describe('AC-2 (007): button hidden when at least one element is visible in viewport', () => {
  it('no button when element is inside the camera viewport', () => {
    // Camera at origin, zoom=1, viewport 800x600: element at (100,100,50,50) is visible
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });
    useElementsStore.getState().setElements([makeEl('a', 100, 100, 50, 50)]);
    render(<BackToContent containerRef={makeContainerRef()} />);
    expect(screen.queryByRole('button', { name: /back to content/i })).toBeNull();
  });
});

// @covers AC-1
describe('AC-1 (007): button shown when all elements are off-screen', () => {
  it('shows button when element is far off to the right', () => {
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });
    useElementsStore.getState().setElements([makeEl('a', 10000, 10000, 100, 100)]);
    render(<BackToContent containerRef={makeContainerRef()} />);
    expect(screen.getByRole('button', { name: /back to content/i })).toBeInTheDocument();
  });

  it('shows button when element is to the left of viewport (negative world)', () => {
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });
    useElementsStore.getState().setElements([makeEl('a', -5000, -5000, 100, 100)]);
    render(<BackToContent containerRef={makeContainerRef()} />);
    expect(screen.getByRole('button', { name: /back to content/i })).toBeInTheDocument();
  });
});

// @covers AC-4
describe('AC-4 (007): clicking button fits camera to content with padding', () => {
  it('updates camera zoom and position to fit the element with FIT_PADDING', () => {
    // Element at (10000,10000) size 200×100; viewport 800×600
    // Expected zoom = min(800*0.85/200, 600*0.85/100) = min(3.4, 5.1) = 3.4
    // centerX=10100, centerY=10050
    // camX = 10100 - 400/3.4; camY = 10050 - 300/3.4
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });
    useElementsStore.getState().setElements([makeEl('a', 10000, 10000, 200, 100)]);
    render(<BackToContent containerRef={makeContainerRef()} />);

    const btn = screen.getByRole('button', { name: /back to content/i });
    fireEvent.click(btn);

    const { camera } = useCameraStore.getState();
    expect(camera.zoom).toBeCloseTo(3.4, 5);
    expect(camera.x).toBeCloseTo(10100 - 400 / 3.4, 2);
    expect(camera.y).toBeCloseTo(10050 - 300 / 3.4, 2);
  });

  it('@covers AC-5: fit excludes deleted elements', () => {
    // Active at (0,0,100,100); deleted at (50000,50000,100,100)
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });
    useElementsStore.getState().setElements([
      makeEl('a', 0, 0, 100, 100),
      makeEl('b', 50000, 50000, 100, 100, true),
    ]);
    // Camera at origin: element a IS visible, so button should not appear
    // Move camera to make element a off-screen first
    useCameraStore.getState().setCamera({ x: 50000, y: 50000, zoom: 1 });
    render(<BackToContent containerRef={makeContainerRef()} />);
    const btn = screen.getByRole('button', { name: /back to content/i });
    fireEvent.click(btn);
    // After fit: should center on element a (0,0,100,100), not on the deleted element
    const { camera } = useCameraStore.getState();
    // rawZoom = min(800*0.85/100, 600*0.85/100) = min(6.8, 5.1) = 5.1
    expect(camera.zoom).toBeCloseTo(5.1, 5);
  });
});
