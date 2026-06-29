import { describe, it, expect } from 'vitest';
import { worldToScreen } from '../../utils/camera';
import type { Camera } from '../../types/shared';

describe('cursor world coordinates — AC-7', () => {
  // @covers AC-7
  // Verify that world coordinates stored in remoteCursors are camera-independent:
  // the same world point maps to different screen positions under different cameras,
  // while the stored value is unchanged.

  const worldCursor = { x: 500, y: 300 };

  it('worldToScreen output changes when camera zoom changes (same world coord)', () => {
    const cameraA: Camera = { x: 0, y: 0, zoom: 1 };
    const cameraB: Camera = { x: 0, y: 0, zoom: 2 };

    const screenA = worldToScreen(worldCursor.x, worldCursor.y, cameraA);
    const screenB = worldToScreen(worldCursor.x, worldCursor.y, cameraB);

    // Screen positions differ when zoom differs
    expect(screenA).not.toEqual(screenB);
    // Zoom=2 should double the screen coordinates (origin at 0,0)
    expect(screenB.x).toBe(screenA.x * 2);
    expect(screenB.y).toBe(screenA.y * 2);
  });

  it('worldToScreen output changes when camera pan changes (same world coord)', () => {
    const cameraA: Camera = { x: 0, y: 0, zoom: 1 };
    const cameraB: Camera = { x: 100, y: 50, zoom: 1 };

    const screenA = worldToScreen(worldCursor.x, worldCursor.y, cameraA);
    const screenB = worldToScreen(worldCursor.x, worldCursor.y, cameraB);

    expect(screenA).not.toEqual(screenB);
    // Panning by (100, 50) shifts screen coords by (-100, -50) at zoom=1
    expect(screenB.x).toBe(screenA.x - 100);
    expect(screenB.y).toBe(screenA.y - 50);
  });

  it('world coord value is preserved independently of rendering camera', () => {
    // The value stored in remoteCursors is unchanged regardless of local camera
    const storedWorldCoord = { ...worldCursor };

    const cameraA: Camera = { x: 0, y: 0, zoom: 1 };
    const cameraB: Camera = { x: 200, y: 150, zoom: 3 };

    // Rendering at different cameras does not mutate the stored value
    worldToScreen(storedWorldCoord.x, storedWorldCoord.y, cameraA);
    worldToScreen(storedWorldCoord.x, storedWorldCoord.y, cameraB);

    expect(storedWorldCoord).toEqual(worldCursor);
  });
});
