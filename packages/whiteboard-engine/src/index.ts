import type { KnowledgeBlock } from "@beelite/shared";
import type { ViewportState } from "@beelite/shared";
import type { Size } from "./coords.js";
import { worldToScreen } from "./coords.js";

export type { Point, Size } from "./coords.js";
export { clampZoom, screenToWorld, worldToScreen } from "./coords.js";

export { BlockSpatialIndex, type SpatialBBox } from "./spatial-index.js";
export {
  visibleBlockIds,
  visibleBlocksInPaintOrder,
  worldRectFromViewport,
  sortBlocksByZIndex,
  segmentIntersectsRect,
  type WorldRect
} from "./visibility.js";

export {
  computeBoardLayoutPositions,
  type BoardLayoutPresetId,
  type BoardLayoutPresetOptions
} from "./layout-presets.js";

export {
  computeViewportFitToBlocks,
  computeWorldBoundsForBlocks,
  type ComputeViewportFitToBlocksOptions
} from "./viewport-fit.js";

/**
 * @deprecated Prefer {@link visibleBlockIds} + {@link BlockSpatialIndex} for large boards.
 */
export function isBlockVisible(
  block: KnowledgeBlock,
  viewport: ViewportState,
  viewportSize: Size,
  overscan = 220
): boolean {
  const topLeft = worldToScreen({ x: block.x, y: block.y }, viewport);
  const bottomRight = worldToScreen(
    { x: block.x + block.width, y: block.y + block.height },
    viewport
  );

  return (
    bottomRight.x >= -overscan &&
    bottomRight.y >= -overscan &&
    topLeft.x <= viewportSize.width + overscan &&
    topLeft.y <= viewportSize.height + overscan
  );
}
