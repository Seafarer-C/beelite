import type { KnowledgeBlock } from "@beelite/shared";
import type { ViewportState } from "@beelite/shared";
import type { Point, Size } from "./coords.js";
import { screenToWorld } from "./coords.js";
import type { BlockSpatialIndex } from "./spatial-index.js";

export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * World-axis-aligned rectangle visible in the viewport (screen), plus overscan in **screen px**.
 */
export function worldRectFromViewport(
  viewport: ViewportState,
  viewportSize: Size,
  overscanPx: number
): WorldRect {
  const topLeft = screenToWorld({ x: -overscanPx, y: -overscanPx }, viewport);
  const bottomRight = screenToWorld(
    {
      x: viewportSize.width + overscanPx,
      y: viewportSize.height + overscanPx
    },
    viewport
  );

  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxX: Math.max(topLeft.x, bottomRight.x),
    maxY: Math.max(topLeft.y, bottomRight.y)
  };
}

export function visibleBlockIds(
  index: BlockSpatialIndex,
  viewport: ViewportState,
  viewportSize: Size,
  overscanPx = 220
): string[] {
  const r = worldRectFromViewport(viewport, viewportSize, overscanPx);
  return index.searchWorldRect(r.minX, r.minY, r.maxX, r.maxY);
}

/** Stable paint order: low z first. */
export function sortBlocksByZIndex(blocks: KnowledgeBlock[]): KnowledgeBlock[] {
  return [...blocks].sort((a, b) => a.zIndex - b.zIndex);
}

/**
 * Filter + z-order. Caller owns `allBlocks`; typically from store.
 */
export function visibleBlocksInPaintOrder(
  allBlocks: readonly KnowledgeBlock[],
  visibleIds: ReadonlySet<string>
): KnowledgeBlock[] {
  const picked = allBlocks.filter((b) => visibleIds.has(b.id));
  return sortBlocksByZIndex(picked);
}

/** Optional: clip segment to world rect (for overlay culling). */
export function segmentIntersectsRect(
  from: Point,
  to: Point,
  rect: WorldRect
): boolean {
  const minX = Math.min(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxX = Math.max(from.x, to.x);
  const maxY = Math.max(from.y, to.y);
  return !(maxX < rect.minX || minX > rect.maxX || maxY < rect.minY || minY > rect.maxY);
}
