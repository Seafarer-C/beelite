import type { KnowledgeBlock } from "@beelite/shared";

/** 内置白板排版预设（供工具栏 / 快捷键调用） */
export type BoardLayoutPresetId =
  | "resolve-overlaps"
  | "grid"
  | "horizontal-row"
  | "vertical-column"
  | "circle"
  | "snake-grid"
  | "two-columns"
  | "brick-rows"
  | "phyllo-spiral";

export interface BoardLayoutPresetOptions {
  /** 要移动的块 id；必须非空，且均属于 activeSpaceId */
  movableIds: ReadonlySet<string>;
  /** 块与块之间的最小外沿间距 */
  gutter?: number;
  /** 结束后将坐标对齐到该步长（0 表示不吸附） */
  gridSnap?: number;
  /** resolve-overlaps 最大迭代轮次 */
  maxOverlapIterations?: number;
}

function snapCoord(v: number, step: number): number {
  if (step <= 0) return v;
  return Math.round(v / step) * step;
}

function getMovableBlocks(
  allBlocks: readonly KnowledgeBlock[],
  spaceId: string,
  movableIds: ReadonlySet<string>
): KnowledgeBlock[] {
  return allBlocks.filter((b) => b.spaceId === spaceId && movableIds.has(b.id));
}

function bboxOf(blocks: readonly KnowledgeBlock[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of blocks) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, cx: 0, cy: 0 };
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2
  };
}

function overlapPenetration(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): { ox: number; oy: number } | null {
  const ox = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
  const oy = Math.min(ay + ah, by + bh) - Math.max(ay, by);
  if (ox <= 0 || oy <= 0) return null;
  return { ox, oy };
}

function hasGap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  gutter: number
): boolean {
  return (
    ax + aw + gutter <= bx ||
    bx + bw + gutter <= ax ||
    ay + ah + gutter <= by ||
    by + bh + gutter <= ay
  );
}

/**
 * 迭代分离重叠矩形（选中块之间 + 选中块与未选同空间块），思路接近 noverlap。
 */
function layoutResolveOverlaps(
  allBlocks: readonly KnowledgeBlock[],
  spaceId: string,
  movableIds: ReadonlySet<string>,
  gutter: number,
  maxIter: number
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  for (const b of allBlocks) {
    if (b.spaceId === spaceId) {
      pos.set(b.id, { x: b.x, y: b.y });
    }
  }

  const fixedIds = new Set(
    allBlocks.filter((b) => b.spaceId === spaceId && !movableIds.has(b.id)).map((b) => b.id)
  );

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    const trySeparate = (ia: string, ib: string, aMove: boolean, bMove: boolean): void => {
      const ba = allBlocks.find((b) => b.id === ia);
      const bb = allBlocks.find((b) => b.id === ib);
      if (!ba || !bb) return;
      const pa = pos.get(ia)!;
      const pb = pos.get(ib)!;
      if (hasGap(pa.x, pa.y, ba.width, ba.height, pb.x, pb.y, bb.width, bb.height, gutter)) {
        return;
      }
      const pen = overlapPenetration(
        pa.x,
        pa.y,
        ba.width,
        ba.height,
        pb.x,
        pb.y,
        bb.width,
        bb.height
      );
      if (!pen) return;

      const bias = gutter * 0.35 + 0.5;
      if (pen.ox < pen.oy) {
        const full = pen.ox + bias;
        const sign = pa.x + ba.width / 2 <= pb.x + bb.width / 2 ? -1 : 1;
        if (aMove && bMove) {
          const half = full / 2;
          pa.x += sign * half;
          pb.x -= sign * half;
          changed = true;
        } else if (aMove) {
          pa.x += sign * full;
          changed = true;
        } else if (bMove) {
          pb.x -= sign * full;
          changed = true;
        }
      } else {
        const full = pen.oy + bias;
        const sign = pa.y + ba.height / 2 <= pb.y + bb.height / 2 ? -1 : 1;
        if (aMove && bMove) {
          const half = full / 2;
          pa.y += sign * half;
          pb.y -= sign * half;
          changed = true;
        } else if (aMove) {
          pa.y += sign * full;
          changed = true;
        } else if (bMove) {
          pb.y -= sign * full;
          changed = true;
        }
      }
    };

    const movers = [...movableIds];
    for (let i = 0; i < movers.length; i++) {
      for (let j = i + 1; j < movers.length; j++) {
        trySeparate(movers[i]!, movers[j]!, true, true);
      }
    }
    for (const mid of movers) {
      for (const fid of fixedIds) {
        trySeparate(mid, fid, true, false);
      }
    }

    if (!changed) break;
  }

  const out = new Map<string, { x: number; y: number }>();
  for (const id of movableIds) {
    const p = pos.get(id);
    if (p) out.set(id, { x: p.x, y: p.y });
  }
  return out;
}

function sortBlocksReadingOrder(blocks: KnowledgeBlock[]): KnowledgeBlock[] {
  return [...blocks].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    return a.id.localeCompare(b.id);
  });
}

function layoutGrid(
  movable: KnowledgeBlock[],
  gutter: number,
  snake: boolean
): Map<string, { x: number; y: number }> {
  const sorted = sortBlocksReadingOrder(movable);
  const n = sorted.length;
  if (n === 0) return new Map();

  const box = bboxOf(sorted);
  const maxW = Math.max(...sorted.map((b) => b.width)) + gutter;
  const rowH = Math.max(...sorted.map((b) => b.height)) + gutter;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const out = new Map<string, { x: number; y: number }>();

  for (let i = 0; i < n; i++) {
    const b = sorted[i]!;
    const row = Math.floor(i / cols);
    const colInRow = i % cols;
    const col = snake && row % 2 === 1 ? cols - 1 - colInRow : colInRow;
    const x = box.minX + col * maxW;
    const y = box.minY + row * rowH;
    out.set(b.id, { x, y });
  }
  return out;
}

function layoutHorizontalRow(movable: KnowledgeBlock[], gutter: number): Map<string, { x: number; y: number }> {
  const sorted = sortBlocksReadingOrder(movable);
  const box = bboxOf(sorted);
  const out = new Map<string, { x: number; y: number }>();
  let x = box.minX;
  for (const b of sorted) {
    const y = box.minY + (box.maxY - box.minY - b.height) / 2;
    out.set(b.id, { x, y });
    x += b.width + gutter;
  }
  return out;
}

function layoutVerticalColumn(movable: KnowledgeBlock[], gutter: number): Map<string, { x: number; y: number }> {
  const sorted = sortBlocksReadingOrder(movable);
  const box = bboxOf(sorted);
  const out = new Map<string, { x: number; y: number }>();
  let y = box.minY;
  for (const b of sorted) {
    const x = box.minX + (box.maxX - box.minX - b.width) / 2;
    out.set(b.id, { x, y });
    y += b.height + gutter;
  }
  return out;
}

function layoutCircle(movable: KnowledgeBlock[], gutter: number): Map<string, { x: number; y: number }> {
  const sorted = sortBlocksReadingOrder(movable);
  const n = sorted.length;
  const box = bboxOf(sorted);
  const out = new Map<string, { x: number; y: number }>();
  if (n === 0) return out;

  const maxDim = Math.max(...sorted.map((b) => Math.max(b.width, b.height)));
  const R = Math.max(80 + n * 12, maxDim * 0.55 + gutter * n);

  for (let i = 0; i < n; i++) {
    const b = sorted[i]!;
    const t = (-Math.PI / 2 + (2 * Math.PI * i) / n) % (2 * Math.PI);
    const cx = box.cx + R * Math.cos(t) - b.width / 2;
    const cy = box.cy + R * Math.sin(t) - b.height / 2;
    out.set(b.id, { x: cx, y: cy });
  }
  return out;
}

/** 双列：阅读序前半一列、后半一列，整体保持原包围盒中心 */
function layoutTwoColumns(movable: KnowledgeBlock[], gutter: number): Map<string, { x: number; y: number }> {
  const sorted = sortBlocksReadingOrder(movable);
  const n = sorted.length;
  const out = new Map<string, { x: number; y: number }>();
  if (n === 0) return out;

  const box = bboxOf(sorted);
  const mid = Math.ceil(n / 2);
  const left = sorted.slice(0, mid);
  const right = sorted.slice(mid);
  const maxWLeft = left.length ? Math.max(...left.map((b) => b.width)) : 0;
  const maxWRight = right.length ? Math.max(...right.map((b) => b.width)) : 0;
  const colGap = gutter + 8;
  const pairW = maxWLeft + colGap + maxWRight;
  const startX = box.cx - pairW / 2;

  const placeColumn = (blocks: KnowledgeBlock[], colX: number, colMaxW: number): void => {
    const totalH =
      blocks.reduce((s, b) => s + b.height, 0) + gutter * Math.max(0, blocks.length - 1);
    let y = box.cy - totalH / 2;
    for (const b of blocks) {
      const x = colX + (colMaxW - b.width) / 2;
      out.set(b.id, { x, y });
      y += b.height + gutter;
    }
  };

  placeColumn(left, startX, maxWLeft);
  placeColumn(right, startX + maxWLeft + colGap, maxWRight);
  return out;
}

/** 砖形错行：偶数行水平偏移半格，更紧凑 */
function layoutBrickRows(movable: KnowledgeBlock[], gutter: number): Map<string, { x: number; y: number }> {
  const sorted = sortBlocksReadingOrder(movable);
  const n = sorted.length;
  const out = new Map<string, { x: number; y: number }>();
  if (n === 0) return out;

  const box = bboxOf(sorted);
  const maxW = Math.max(...sorted.map((b) => b.width)) + gutter;
  const rowH = Math.max(...sorted.map((b) => b.height)) + gutter;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.15)));
  const brickShift = maxW * 0.5;

  for (let i = 0; i < n; i++) {
    const b = sorted[i]!;
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = box.minX + col * maxW + (row % 2 === 1 ? brickShift : 0);
    const y = box.minY + row * rowH;
    out.set(b.id, { x, y });
  }
  return out;
}

/** 叶序螺旋：围绕选区中心黄金角展开，适合较多节点 */
function layoutPhylloSpiral(movable: KnowledgeBlock[], gutter: number): Map<string, { x: number; y: number }> {
  const sorted = sortBlocksReadingOrder(movable);
  const n = sorted.length;
  const out = new Map<string, { x: number; y: number }>();
  if (n === 0) return out;

  const box = bboxOf(sorted);
  const maxDim = Math.max(...sorted.map((b) => Math.max(b.width, b.height)));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spread = Math.max(gutter * 1.1, maxDim * 0.35);

  for (let i = 0; i < n; i++) {
    const b = sorted[i]!;
    const r = spread * Math.sqrt(i + 0.55);
    const t = i * golden;
    const cx = box.cx + r * Math.cos(t);
    const cy = box.cy + r * Math.sin(t);
    out.set(b.id, { x: cx - b.width / 2, y: cy - b.height / 2 });
  }
  return out;
}

/**
 * 根据预设计算一组可移动块的 (x,y)，不修改入参。
 */
export function computeBoardLayoutPositions(
  allBlocks: readonly KnowledgeBlock[],
  activeSpaceId: string,
  preset: BoardLayoutPresetId,
  options: BoardLayoutPresetOptions
): Map<string, { x: number; y: number }> {
  const gutter = options.gutter ?? 16;
  const gridSnap = options.gridSnap ?? 0;
  const maxOverlapIterations = options.maxOverlapIterations ?? 90;
  const movable = getMovableBlocks(allBlocks, activeSpaceId, options.movableIds);
  if (movable.length === 0) return new Map();

  let map: Map<string, { x: number; y: number }>;
  switch (preset) {
    case "resolve-overlaps":
      map = layoutResolveOverlaps(allBlocks, activeSpaceId, options.movableIds, gutter, maxOverlapIterations);
      break;
    case "grid":
      map = layoutGrid(movable, gutter, false);
      break;
    case "snake-grid":
      map = layoutGrid(movable, gutter, true);
      break;
    case "horizontal-row":
      map = layoutHorizontalRow(movable, gutter);
      break;
    case "vertical-column":
      map = layoutVerticalColumn(movable, gutter);
      break;
    case "circle":
      map = layoutCircle(movable, gutter);
      break;
    case "two-columns":
      map = layoutTwoColumns(movable, gutter);
      break;
    case "brick-rows":
      map = layoutBrickRows(movable, gutter);
      break;
    case "phyllo-spiral":
      map = layoutPhylloSpiral(movable, gutter);
      break;
    default:
      map = new Map();
  }

  if (gridSnap > 0) {
    for (const [id, p] of map) {
      map.set(id, {
        x: snapCoord(p.x, gridSnap),
        y: snapCoord(p.y, gridSnap)
      });
    }
  }

  return map;
}
