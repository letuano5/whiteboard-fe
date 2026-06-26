import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onLaserPointerMove, onLaserPointerLeave, clearLaserTrail } from '../laser-tool';
import { useInteractionStore } from '../../../store/interaction.store';
import { useElementsStore } from '../../../store/elements.store';
import type { Point } from '../../../types/geometry';

const pt = (x: number, y: number): Point => ({ x, y });

beforeEach(() => {
  vi.useFakeTimers();
  useInteractionStore.getState().reset();
});

afterEach(() => {
  clearLaserTrail();
  vi.useRealTimers();
});

// @covers AC-1
describe('onLaserPointerMove — trail accumulates', () => {
  it('adds a point to laserTrail', () => {
    onLaserPointerMove(pt(10, 20));
    expect(useInteractionStore.getState().laserTrail).toEqual([pt(10, 20)]);
  });

  it('appends subsequent points', () => {
    onLaserPointerMove(pt(10, 20));
    onLaserPointerMove(pt(30, 40));
    const trail = useInteractionStore.getState().laserTrail;
    expect(trail).toHaveLength(2);
    expect(trail[1]).toEqual(pt(30, 40));
  });

  it('caps trail at 80 points', () => {
    for (let i = 0; i < 100; i++) onLaserPointerMove(pt(i, i));
    expect(useInteractionStore.getState().laserTrail).toHaveLength(80);
  });
});

// @covers AC-2
describe('auto-clear after 1500ms', () => {
  it('clears laserTrail after 1500ms with no new movement', () => {
    onLaserPointerMove(pt(5, 5));
    expect(useInteractionStore.getState().laserTrail).toHaveLength(1);

    vi.advanceTimersByTime(1500);

    expect(useInteractionStore.getState().laserTrail).toHaveLength(0);
    expect(useInteractionStore.getState().laserFading).toBe(false);
  });

  it('sets laserFading=true at 1000ms before clearing', () => {
    onLaserPointerMove(pt(5, 5));

    vi.advanceTimersByTime(1000);
    expect(useInteractionStore.getState().laserFading).toBe(true);
    expect(useInteractionStore.getState().laserTrail).toHaveLength(1);

    vi.advanceTimersByTime(500);
    expect(useInteractionStore.getState().laserTrail).toHaveLength(0);
    expect(useInteractionStore.getState().laserFading).toBe(false);
  });
});

// @covers AC-3
describe('timer resets on each move', () => {
  it('keeps trail visible when user keeps moving before 1000ms', () => {
    onLaserPointerMove(pt(1, 1));
    vi.advanceTimersByTime(900);
    onLaserPointerMove(pt(2, 2));
    vi.advanceTimersByTime(900);

    // Still not fading — timer was reset on second move
    expect(useInteractionStore.getState().laserFading).toBe(false);
    expect(useInteractionStore.getState().laserTrail).toHaveLength(2);
  });

  it('extends clear deadline on each new move', () => {
    onLaserPointerMove(pt(1, 1));
    vi.advanceTimersByTime(1400);
    onLaserPointerMove(pt(2, 2)); // reset timers

    vi.advanceTimersByTime(1400); // original clear would have fired, but timer was reset
    expect(useInteractionStore.getState().laserTrail).toHaveLength(2);

    vi.advanceTimersByTime(200); // now 1600ms after last move → clears
    expect(useInteractionStore.getState().laserTrail).toHaveLength(0);
  });
});

// @covers AC-6 — trail never added to elements store
describe('elements store isolation', () => {
  it('does not add any entry to elements store after move', () => {
    const before = useElementsStore.getState().elements.length;
    onLaserPointerMove(pt(10, 20));
    onLaserPointerMove(pt(30, 40));
    vi.advanceTimersByTime(1500);
    expect(useElementsStore.getState().elements.length).toBe(before);
  });
});

// @covers AC-7 — trail not persisted to localStorage
describe('localStorage isolation', () => {
  it('does not write laserTrail to localStorage', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    onLaserPointerMove(pt(10, 20));
    vi.advanceTimersByTime(1500);
    // None of the localStorage.setItem calls should contain "laser"
    const laserWrites = setSpy.mock.calls.filter(([key]) =>
      String(key).toLowerCase().includes('laser'),
    );
    expect(laserWrites).toHaveLength(0);
    setSpy.mockRestore();
  });
});

// @covers AC-9 — leaving canvas clears trail immediately
describe('onLaserPointerLeave', () => {
  it('clears trail and fading flag immediately without waiting for timers', () => {
    onLaserPointerMove(pt(1, 1));
    onLaserPointerMove(pt(2, 2));
    expect(useInteractionStore.getState().laserTrail).toHaveLength(2);

    onLaserPointerLeave();

    expect(useInteractionStore.getState().laserTrail).toHaveLength(0);
    expect(useInteractionStore.getState().laserFading).toBe(false);
  });

  it('cancels pending timers so they do not fire after leave', () => {
    onLaserPointerMove(pt(1, 1));
    onLaserPointerLeave();
    vi.advanceTimersByTime(2000);
    // Trail should still be empty — timers were cancelled
    expect(useInteractionStore.getState().laserTrail).toHaveLength(0);
  });
});

// @covers AC-5 — clearLaserTrail (called when switching tools)
describe('clearLaserTrail', () => {
  it('clears trail and resets fading immediately', () => {
    onLaserPointerMove(pt(1, 1));
    clearLaserTrail();
    expect(useInteractionStore.getState().laserTrail).toHaveLength(0);
    expect(useInteractionStore.getState().laserFading).toBe(false);
  });
});
