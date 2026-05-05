import type { KnowledgeBlock, ViewportState } from "@beelite/shared";
import { clampZoom } from "./coords.js";
import type { Size } from "./coords.js";

export interface ComputeViewportFitToBlocksOptions {
  spaceId: string;
  /** 仅包含这些块；缺省为当前空间内全部块 */
  blockIds?: ReadonlySet<string>;
  /** 视口边缘留白（屏幕像素） */
  padding?: number;
}

/**
 * 计算当前空间（或指定子集）块的世界坐标包围盒。
 */
export function computeWorldBoundsForBlocks(
  blocks: readonly KnowledgeBlock[],
  spaceId: string,
  blockIds?: ReadonlySet<string>
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const b of blocks) {
    if (b.spaceId !== spaceId) continue;
    if (blockIds && !blockIds.has(b.id)) continue;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

const DEFAULT_FALLBACK_WORLD = 480;

/**
 * 计算将给定块全部纳入视窗所需的 {@link ViewportState}（平移 + 缩放），
 * 使包围盒居中并等比缩放至 `viewportPixels` 内可见。
 */
export function computeViewportFitToBlocks(
  blocks: readonly KnowledgeBlock[],
  fitOptions: ComputeViewportFitToBlocksOptions,
  viewportPixels: Size
): ViewportState {
  const pad = fitOptions.padding ?? 48;
  const vw = Math.max(64, viewportPixels.width);
  const vh = Math.max(64, viewportPixels.height);
  const bounds = computeWorldBoundsForBlocks(blocks, fitOptions.spaceId, fitOptions.blockIds);

  if (!bounds) {
    const z = clampZoom(0.5);
    return { x: vw / 2, y: vh / 2, zoom: z };
  }

  let w = bounds.maxX - bounds.minX;
  let h = bounds.maxY - bounds.minY;
  if (w < 1) w = DEFAULT_FALLBACK_WORLD;
  if (h < 1) h = DEFAULT_FALLBACK_WORLD;

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  const availW = Math.max(32, vw - 2 * pad);
  const availH = Math.max(32, vh - 2 * pad);
  const zoom = clampZoom(Math.min(availW / w, availH / h));

  return {
    x: vw / 2 - cx * zoom,
    y: vh / 2 - cy * zoom,
    zoom
  };
}
