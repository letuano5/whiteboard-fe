export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

export interface Camera {
  x: number;
  y: number;
  zoom: number; // clamped [MIN_ZOOM, MAX_ZOOM]
}
