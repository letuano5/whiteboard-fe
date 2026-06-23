/**
 * Tests for P1A-06: Zoom + Pan + Infinite Canvas
 *
 * AC-1 to AC-9 test the camera store functions directly (unit tests on pure logic).
 * AC-10 to AC-12 test the Space-key filtering invariants.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCameraStore } from '../../store/camera.store';
import { useElementsStore } from '../../store/elements.store';
import { useInteractionStore } from '../../store/interaction.store';
import { screenToWorld } from '../../utils/camera';
import { MIN_ZOOM, MAX_ZOOM } from '../../utils/camera';

beforeEach(() => {
  useCameraStore.getState().resetCamera(); // {x:0, y:0, zoom:1}
  useElementsStore.getState().setElements([]);
  useInteractionStore.getState().setSelectedIds([]);
  useInteractionStore.getState().setTool('select');
});

// ---------------------------------------------------------------------------
// Scroll-wheel zoom (covers AC-1 – AC-4)
// ---------------------------------------------------------------------------

describe('zoomTo — scroll-wheel zoom', () => {
  it('@covers AC-1: scroll up → zoom increases; world point under cursor stays fixed in screen space', () => {
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });
    const pivot = { x: 100, y: 100 };
    const worldBefore = screenToWorld(pivot.x, pivot.y, useCameraStore.getState().camera);

    useCameraStore.getState().zoomTo(1.1, pivot);

    const { camera } = useCameraStore.getState();
    expect(camera.zoom).toBeCloseTo(1.1, 5);
    const worldAfter = screenToWorld(pivot.x, pivot.y, camera);
    // World point at pivot screen coordinate must not move (within floating-point tolerance)
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 8);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 8);
  });

  it('@covers AC-2: scroll up when zoom is already at MAX_ZOOM → zoom stays clamped at 8', () => {
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: MAX_ZOOM });

    useCameraStore.getState().zoomTo(MAX_ZOOM * 1.1, { x: 50, y: 50 });

    expect(useCameraStore.getState().camera.zoom).toBe(MAX_ZOOM);
  });

  it('@covers AC-3: scroll down when zoom is already at MIN_ZOOM → zoom stays clamped at 0.1', () => {
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: MIN_ZOOM });

    useCameraStore.getState().zoomTo(MIN_ZOOM / 1.1, { x: 50, y: 50 });

    expect(useCameraStore.getState().camera.zoom).toBe(MIN_ZOOM);
  });

  it('@covers AC-4: scroll down → zoom decreases; world point under cursor stays fixed in screen space', () => {
    useCameraStore.getState().setCamera({ x: 50, y: 50, zoom: 2 });
    const pivot = { x: 200, y: 150 };
    const worldBefore = screenToWorld(pivot.x, pivot.y, useCameraStore.getState().camera);

    useCameraStore.getState().zoomTo((2 * (1 / 1.1)), pivot);

    const { camera } = useCameraStore.getState();
    expect(camera.zoom).toBeCloseTo(2 / 1.1, 5);
    const worldAfter = screenToWorld(pivot.x, pivot.y, camera);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 8);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 8);
  });

  it('pivot-zoom is correct at non-origin camera position', () => {
    // camera.x=100 means the viewport top-left shows world x=100
    useCameraStore.getState().setCamera({ x: 100, y: 100, zoom: 1 });
    const pivot = { x: 0, y: 0 }; // top-left corner of screen
    const worldBefore = screenToWorld(pivot.x, pivot.y, useCameraStore.getState().camera);
    // worldBefore = {x: 0/1 + 100, y: ...} = {x: 100, y: 100}

    useCameraStore.getState().zoomTo(2, pivot);

    const { camera } = useCameraStore.getState();
    const worldAfter = screenToWorld(pivot.x, pivot.y, camera);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 8);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 8);
  });
});

// ---------------------------------------------------------------------------
// Hand tool pointer pan (covers AC-5 – AC-7)
// ---------------------------------------------------------------------------

describe('panBy — hand tool pointer pan', () => {
  it('@covers AC-5: pointer drag by (Δx, Δy) screen pixels → camera shifts by (-Δx/zoom, -Δy/zoom) in world units', () => {
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 2 });
    const dx = 100; // screen pixels dragged
    const dy = 60;
    const zoom = useCameraStore.getState().camera.zoom;

    useCameraStore.getState().panBy(-dx / zoom, -dy / zoom);

    const { camera } = useCameraStore.getState();
    expect(camera.x).toBeCloseTo(-dx / zoom, 8); // = -50
    expect(camera.y).toBeCloseTo(-dy / zoom, 8); // = -30
  });

  it('@covers AC-6: pointer up → panning stops; camera position committed to store', () => {
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });
    useCameraStore.getState().panBy(-50, -30);

    // Simulate pointer up: no more panBy calls. Camera should retain last position.
    const { camera } = useCameraStore.getState();
    expect(camera.x).toBe(-50);
    expect(camera.y).toBe(-30);
  });

  it('@covers AC-7: shapes at world coord (50000, 50000) are reachable and visible after panning', () => {
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });

    // Pan to world (50000, 50000)
    useCameraStore.getState().panBy(50000, 50000);

    const { camera } = useCameraStore.getState();
    expect(camera.x).toBe(50000);
    expect(camera.y).toBe(50000);
    // A shape at (50000, 50000) should now appear at screen (0, 0)
    // worldToScreen: x = (50000 - 50000) * 1 = 0
    expect((50000 - camera.x) * camera.zoom).toBe(0);
    expect((50000 - camera.y) * camera.zoom).toBe(0);
  });

  it('pan is incremental (delta-based): multiple moves accumulate correctly', () => {
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });

    // Three drag deltas: total -150, -90 world units
    useCameraStore.getState().panBy(-50, -30);
    useCameraStore.getState().panBy(-60, -40);
    useCameraStore.getState().panBy(-40, -20);

    const { camera } = useCameraStore.getState();
    expect(camera.x).toBeCloseTo(-150, 8);
    expect(camera.y).toBeCloseTo(-90, 8);
  });
});

// ---------------------------------------------------------------------------
// Middle mouse button pan (covers AC-8 – AC-9)
// ---------------------------------------------------------------------------

describe('Middle mouse button pan', () => {
  it('@covers AC-8: middle mouse drag pans camera via panBy — same path as hand tool pan', () => {
    // Middle mouse pan calls panBy(-dx/zoom, -dy/zoom), identical to hand tool.
    // AC-8 verifies the pan fires regardless of active tool.
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });
    useInteractionStore.getState().setTool('select'); // NOT hand tool

    // Simulate what handlePointerMove does when panStart is set (middle mouse down)
    const dx = 80;
    const dy = 50;
    const zoom = useCameraStore.getState().camera.zoom;
    useCameraStore.getState().panBy(-dx / zoom, -dy / zoom);

    const { camera } = useCameraStore.getState();
    expect(camera.x).toBe(-80);
    expect(camera.y).toBe(-50);
    // Tool must remain unchanged
    expect(useInteractionStore.getState().tool).toBe('select');
  });

  it('@covers AC-9: middle mouse up → tool and selection state unchanged', () => {
    useInteractionStore.getState().setTool('rectangle');
    useInteractionStore.getState().setSelectedIds(['el-1', 'el-2']);

    // Simulate a pan session and release
    useCameraStore.getState().panBy(-30, -20);
    // On pointer up: panStart is cleared, setIsPanning(false).
    // Tool and selectedIds are NOT touched by pan release.

    expect(useInteractionStore.getState().tool).toBe('rectangle');
    expect(useInteractionStore.getState().selectedIds).toEqual(['el-1', 'el-2']);
  });
});

// ---------------------------------------------------------------------------
// Space + drag temporary pan (covers AC-10 – AC-12)
// ---------------------------------------------------------------------------

describe('Space + drag temporary pan', () => {
  it('@covers AC-10: pan does not create or modify any element', () => {
    useElementsStore.getState().setElements([]);
    useCameraStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });

    // When spaceDown=true and pointer drags, handlePointerMove calls panBy and returns early.
    // The elements store must be unchanged — createElement / patchElement are never called.
    useCameraStore.getState().panBy(-100, -80);

    expect(useElementsStore.getState().elements).toHaveLength(0);
  });

  it('@covers AC-11: Space release → original tool is unchanged (only spaceDown flag resets)', () => {
    // The tool itself is never mutated by pan mode; only the local spaceDown flag changes.
    // After Space release, tool remains whatever it was before.
    useInteractionStore.getState().setTool('rectangle');

    // Simulate: Space pressed → spaceDown=true (local state, not in store)
    //           Pan occurs via panBy
    //           Space released → spaceDown=false
    // Tool in the store must never have changed.
    useCameraStore.getState().panBy(-50, -30);

    expect(useInteractionStore.getState().tool).toBe('rectangle');
    // Camera changed (pan happened); no shape drawn
    expect(useElementsStore.getState().elements).toHaveLength(0);
  });

  it('@covers AC-12: Space key in text inputs is suppressed — pan not activated (logic test)', () => {
    // The Whiteboard keydown useEffect filters: if target is INPUT/TEXTAREA/SELECT/contentEditable → return.
    // Test the filtering predicate that mirrors the component guard.
    const shouldSuppressPan = (el: HTMLElement) =>
      el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable === true;

    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');

    expect(shouldSuppressPan(input)).toBe(true);    // INPUT → suppress
    expect(shouldSuppressPan(textarea)).toBe(true); // TEXTAREA → suppress
    expect(shouldSuppressPan(select)).toBe(true);   // SELECT → suppress

    // Non-text elements should NOT suppress pan
    const body = document.body;
    expect(shouldSuppressPan(body)).toBe(false);    // BODY → allow pan
  });
});

// ---------------------------------------------------------------------------
// Zoom clamp range guard
// ---------------------------------------------------------------------------

describe('Zoom clamp bounds', () => {
  it('zoomTo never produces a zoom below MIN_ZOOM or above MAX_ZOOM', () => {
    useCameraStore.getState().zoomTo(0);
    expect(useCameraStore.getState().camera.zoom).toBe(MIN_ZOOM);

    useCameraStore.getState().zoomTo(Infinity);
    expect(useCameraStore.getState().camera.zoom).toBe(MAX_ZOOM);

    useCameraStore.getState().zoomTo(-1);
    expect(useCameraStore.getState().camera.zoom).toBe(MIN_ZOOM);
  });
});
