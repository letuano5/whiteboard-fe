import { beforeEach, describe, expect, it } from 'vitest';
import { useCameraStore } from './camera.store';

const DEFAULT_CAMERA = { x: 0, y: 0, zoom: 1 };

beforeEach(() => {
  useCameraStore.setState({ camera: DEFAULT_CAMERA });
});

describe('setCamera clamping (H6 audit fix)', () => {
  it('clamps zoom above MAX_ZOOM', () => {
    useCameraStore.getState().setCamera({ x: 5, y: 5, zoom: 999 });
    expect(useCameraStore.getState().camera).toEqual({ x: 5, y: 5, zoom: 8 });
  });

  it('clamps zoom below MIN_ZOOM, including zero and negative values', () => {
    useCameraStore.getState().setCamera({ x: 5, y: 5, zoom: 0 });
    expect(useCameraStore.getState().camera.zoom).toBe(0.1);

    useCameraStore.getState().setCamera({ x: 5, y: 5, zoom: -3 });
    expect(useCameraStore.getState().camera.zoom).toBe(0.1);
  });

  it('falls back to the current zoom when given NaN, keeping the canvas usable', () => {
    useCameraStore.getState().setCamera({ x: 1, y: 2, zoom: 3 });
    useCameraStore.getState().setCamera({ x: 5, y: 6, zoom: NaN });
    expect(useCameraStore.getState().camera).toEqual({ x: 5, y: 6, zoom: 3 });
  });

  it('falls back to the current x/y when given non-finite values', () => {
    useCameraStore.getState().setCamera({ x: 10, y: 20, zoom: 1 });
    useCameraStore.getState().setCamera({ x: Infinity, y: NaN, zoom: 2 });
    expect(useCameraStore.getState().camera).toEqual({ x: 10, y: 20, zoom: 2 });
  });

  it('passes through an already-valid camera unchanged', () => {
    useCameraStore.getState().setCamera({ x: -100, y: 50, zoom: 2.5 });
    expect(useCameraStore.getState().camera).toEqual({ x: -100, y: 50, zoom: 2.5 });
  });
});
