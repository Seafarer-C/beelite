import type { ViewportState } from "@beelite/shared";

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function clampZoom(zoom: number): number {
  return Math.min(1.8, Math.max(0.32, zoom));
}

export function screenToWorld(point: Point, viewport: ViewportState): Point {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom
  };
}

export function worldToScreen(point: Point, viewport: ViewportState): Point {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y
  };
}
