import type { KnowledgeBlock } from "@beelite/shared";
import RBush from "rbush";

/** rbush item: axis-aligned bbox + block id */
export interface SpatialBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
}

function toBBox(block: KnowledgeBlock): SpatialBBox {
  return {
    minX: block.x,
    minY: block.y,
    maxX: block.x + block.width,
    maxY: block.y + block.height,
    id: block.id
  };
}

/**
 * R-tree backed index for viewport queries. Rebuild on batch changes;
 * future: incremental update when dragging a single block.
 */
export class BlockSpatialIndex {
  private readonly tree = new RBush<SpatialBBox>();

  clear(): void {
    this.tree.clear();
  }

  /** Full rebuild — call when `blocks` array content changes. */
  load(blocks: readonly KnowledgeBlock[]): void {
    this.clear();
    for (const block of blocks) {
      this.tree.insert(toBBox(block));
    }
  }

  searchWorldRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): string[] {
    return this.tree
      .search({ minX, minY, maxX, maxY })
      .map((b: SpatialBBox) => b.id);
  }
}
