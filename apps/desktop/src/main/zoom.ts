export const MIN_ZOOM_FACTOR = 0.5;
export const MAX_ZOOM_FACTOR = 2;
export const ZOOM_STEP = 0.1;
export const DEFAULT_ZOOM_FACTOR = 1;

export function clampZoomFactor(factor: number): number {
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, factor));
}

export function stepZoomFactor(factor: number, direction: -1 | 1): number {
  return clampZoomFactor(Math.round((factor + direction * ZOOM_STEP) * 10) / 10);
}

export function resetZoomFactor(): number {
  return DEFAULT_ZOOM_FACTOR;
}
