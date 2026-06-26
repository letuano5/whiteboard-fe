import { useInteractionStore } from '../../store/interaction.store';
import type { Point } from '../../types/geometry';

const MAX_POINTS = 80;
const FADE_DELAY_MS = 1000;
const CLEAR_DELAY_MS = 1500;

let fadeTimer: ReturnType<typeof setTimeout> | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function resetTimers(): void {
  if (fadeTimer !== null) clearTimeout(fadeTimer);
  if (clearTimer !== null) clearTimeout(clearTimer);

  const { setLaserFading, setLaserTrail } = useInteractionStore.getState();

  fadeTimer = setTimeout(() => {
    setLaserFading(true);
  }, FADE_DELAY_MS);

  clearTimer = setTimeout(() => {
    setLaserTrail([]);
    setLaserFading(false);
    fadeTimer = null;
    clearTimer = null;
  }, CLEAR_DELAY_MS);
}

export function onLaserPointerMove(pt: Point): void {
  const { laserTrail, setLaserTrail } = useInteractionStore.getState();
  const next = [...laserTrail, pt].slice(-MAX_POINTS);
  setLaserTrail(next);
  resetTimers();
}

export function onLaserPointerLeave(): void {
  clearLaserTrail();
}

export function clearLaserTrail(): void {
  if (fadeTimer !== null) clearTimeout(fadeTimer);
  if (clearTimer !== null) clearTimeout(clearTimer);
  fadeTimer = null;
  clearTimer = null;
  const { setLaserTrail, setLaserFading } = useInteractionStore.getState();
  setLaserTrail([]);
  setLaserFading(false);
}
