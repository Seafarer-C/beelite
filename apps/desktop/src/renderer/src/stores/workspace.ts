import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { PROVIDER_TEMPLATES, DEFAULT_MODEL_ROUTES } from "@beelite/llm-engine";
import type { KnowledgeBlock, ViewportState } from "@beelite/shared";
import { clampZoom } from "@beelite/whiteboard-engine";
import { mockBlocks, mockEdges, mockNodes, mockProposal, rootSpace } from "../data/mockKnowledge";

export type CanvasTool = "hand" | "select" | "note" | "text" | "comment" | "draw" | "image" | "graph";

export const useWorkspaceStore = defineStore("workspace", () => {
  const nodes = ref(mockNodes);
  const edges = ref(mockEdges);
  const spaces = ref([rootSpace]);
  const blocks = ref<KnowledgeBlock[]>(mockBlocks);
  const activeSpaceId = ref(rootSpace.id);
  const activeTool = ref<CanvasTool>("select");
  const selectedBlockId = ref<string | null>("block-node-rag");
  const viewport = ref<ViewportState>({ x: 560, y: 380, zoom: 0.74 });
  const graphProposal = ref(mockProposal);

  const activeSpace = computed(() =>
    spaces.value.find((space) => space.id === activeSpaceId.value) ?? spaces.value[0]
  );

  const selectedBlock = computed(() =>
    blocks.value.find((block) => block.id === selectedBlockId.value) ?? null
  );

  const activeModelRoutes = computed(() => DEFAULT_MODEL_ROUTES.slice(0, 4));
  const providerTemplates = computed(() => PROVIDER_TEMPLATES);

  function setTool(tool: CanvasTool): void {
    activeTool.value = tool;
  }

  function selectBlock(blockId: string | null): void {
    selectedBlockId.value = blockId;
  }

  function panBy(deltaX: number, deltaY: number): void {
    viewport.value = {
      ...viewport.value,
      x: viewport.value.x + deltaX,
      y: viewport.value.y + deltaY
    };
  }

  function zoomBy(delta: number, anchor?: { x: number; y: number }): void {
    const previousZoom = viewport.value.zoom;
    const nextZoom = clampZoom(previousZoom + delta);

    if (!anchor || nextZoom === previousZoom) {
      viewport.value = { ...viewport.value, zoom: nextZoom };
      return;
    }

    const worldX = (anchor.x - viewport.value.x) / previousZoom;
    const worldY = (anchor.y - viewport.value.y) / previousZoom;

    viewport.value = {
      x: anchor.x - worldX * nextZoom,
      y: anchor.y - worldY * nextZoom,
      zoom: nextZoom
    };
  }

  return {
    nodes,
    edges,
    spaces,
    blocks,
    activeSpaceId,
    activeTool,
    selectedBlockId,
    selectedBlock,
    activeSpace,
    activeModelRoutes,
    providerTemplates,
    viewport,
    graphProposal,
    setTool,
    selectBlock,
    panBy,
    zoomBy
  };
});
