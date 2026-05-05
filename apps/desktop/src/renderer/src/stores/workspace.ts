import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { PROVIDER_TEMPLATES, DEFAULT_MODEL_ROUTES } from "@beelite/llm-engine";
import type {
  ImportJob,
  ImportRunResult,
  ImportStats,
  KnowledgeBlock,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeSpace,
  KnowledgeSource,
  LlmSettingsPublic,
  ResearchFetchPageParams,
  ResearchFetchPageResult,
  ResearchSearchParams,
  ResearchSearchResult,
  ResearchSettingsPublic,
  ViewportState,
  WorkspaceSnapshot
} from "@beelite/shared";
import { createRootSpace } from "@beelite/space-engine";
import { clampZoom } from "@beelite/whiteboard-engine";
import {
  mockBlocks,
  mockEdges,
  mockNodes,
  mockProposal,
  rootSpace
} from "../data/mockKnowledge";

export type CanvasTool = "hand" | "select" | "note" | "text" | "comment" | "draw" | "image" | "graph";

export const useWorkspaceStore = defineStore("workspace", () => {
  const nodes = ref<KnowledgeNode[]>(mockNodes);
  const edges = ref<KnowledgeEdge[]>(mockEdges);
  const spaces = ref<KnowledgeSpace[]>([{ ...rootSpace, nodeIds: mockNodes.map((n) => n.id) }]);
  const blocks = ref<KnowledgeBlock[]>([...mockBlocks]);
  const activeSpaceId = ref(rootSpace.id);
  const activeTool = ref<CanvasTool>("select");
  const selectedBlockId = ref<string | null>("block-hero-art");
  const viewport = ref<ViewportState>({ x: 600, y: 420, zoom: 0.5 });
  const graphProposal = ref(mockProposal);
  const importStats = ref<ImportStats | null>(null);
  const importJobs = ref<ImportJob[]>([]);
  const importSources = ref<KnowledgeSource[]>([]);
  const lastImportResult = ref<ImportRunResult | null>(null);
  const importError = ref<string | null>(null);
  const importLoading = ref(false);
  /** True when canvas data comes from SQLite (imported knowledge), not demo mocks */
  const useLiveWorkspace = ref(false);
  const llmSettings = ref<LlmSettingsPublic | null>(null);
  const researchSettings = ref<ResearchSettingsPublic | null>(null);
  const modelSettingsOpen = ref(false);
  /** 画布上点击图片 / 视频 / Markdown 后的全屏预览（参见 Spatial 交互） */
  const previewBlockId = ref<string | null>(null);

  const activeSpace = computed(() =>
    spaces.value.find((space) => space.id === activeSpaceId.value) ?? spaces.value[0]
  );

  const breadcrumbTrail = computed((): KnowledgeSpace[] => {
    const byId = new Map(spaces.value.map((s) => [s.id, s]));
    const chain: KnowledgeSpace[] = [];
    let current: KnowledgeSpace | undefined =
      spaces.value.find((s) => s.id === activeSpaceId.value) ?? spaces.value[0];

    while (current) {
      chain.unshift(current);
      current = current.parentSpaceId ? byId.get(current.parentSpaceId) : undefined;
    }
    return chain;
  });

  const selectedBlock = computed(() =>
    blocks.value.find((block) => block.id === selectedBlockId.value) ?? null
  );

  const activeModelRoutes = computed(
    () => llmSettings.value?.routes ?? DEFAULT_MODEL_ROUTES
  );
  const providerTemplates = computed(() => PROVIDER_TEMPLATES);

  function resetDemoWorkspace(): void {
    nodes.value = mockNodes;
    edges.value = mockEdges;
    spaces.value = [{ ...rootSpace, nodeIds: mockNodes.map((n) => n.id) }];
    blocks.value = [...mockBlocks];
    activeSpaceId.value = rootSpace.id;
    graphProposal.value = mockProposal;
    selectedBlockId.value = "block-hero-art";
    useLiveWorkspace.value = false;
  }

  function applyLiveSnapshot(snapshot: WorkspaceSnapshot): void {
    const fallbackRoot = createRootSpace();
    spaces.value = snapshot.spaces.length > 0 ? snapshot.spaces : [fallbackRoot];
    nodes.value = snapshot.nodes;
    edges.value = snapshot.edges;
    blocks.value = snapshot.blocks;

    const preferredId = activeSpaceId.value;
    const nextSpace =
      spaces.value.find((s) => s.id === preferredId) ?? spaces.value.find((s) => s.id === "space-root");
    activeSpaceId.value = nextSpace?.id ?? spaces.value[0]?.id ?? fallbackRoot.id;

    graphProposal.value = snapshot.proposal ?? mockProposal;
    useLiveWorkspace.value = snapshot.nodes.length > 0;
    selectedBlockId.value = snapshot.blocks[0]?.id ?? null;
  }

  function setTool(tool: CanvasTool): void {
    activeTool.value = tool;
  }

  function selectBlock(blockId: string | null): void {
    selectedBlockId.value = blockId;
  }

  /** 世界坐标增量（已将屏幕位移除以 zoom）。 */
  function moveBlockBy(blockId: string, deltaWorldX: number, deltaWorldY: number): void {
    const i = blocks.value.findIndex((b) => b.id === blockId);
    if (i === -1) return;
    const b = blocks.value[i];
    blocks.value[i] = {
      ...b,
      x: b.x + deltaWorldX,
      y: b.y + deltaWorldY
    };
  }

  function updateBlockBody(blockId: string, body: string): void {
    const i = blocks.value.findIndex((b) => b.id === blockId);
    if (i === -1) return;
    const b = blocks.value[i];
    blocks.value[i] = {
      ...b,
      content: { ...b.content, body }
    };
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

  async function refreshStorage(): Promise<void> {
    if (!window.beelite) return;

    const [stats, jobs, sources] = await Promise.all([
      window.beelite.storageStats(),
      window.beelite.listImportJobs(),
      window.beelite.listSources()
    ]);
    importStats.value = stats;
    importJobs.value = jobs;
    importSources.value = sources;
  }

  async function refreshLlmSettings(): Promise<void> {
    if (!window.beelite?.getLlmSettings) return;
    const data = await window.beelite.getLlmSettings();
    if (data) llmSettings.value = data;
  }

  async function refreshResearchSettings(): Promise<void> {
    if (!window.beelite?.getResearchSettings) return;
    const data = await window.beelite.getResearchSettings();
    researchSettings.value = data;
  }

  async function researchSearch(params: ResearchSearchParams): Promise<ResearchSearchResult> {
    if (!window.beelite?.researchSearch) {
      return {
        ok: false,
        query: params.query ?? "",
        results: [],
        error: "Electron IPC 未连接"
      };
    }
    return window.beelite.researchSearch(params);
  }

  async function researchFetchPage(params: ResearchFetchPageParams): Promise<ResearchFetchPageResult> {
    if (!window.beelite?.researchFetchPage) {
      return {
        ok: false,
        error: "Electron IPC 未连接"
      };
    }
    return window.beelite.researchFetchPage(params);
  }

  function setModelSettingsOpen(value: boolean): void {
    modelSettingsOpen.value = value;
  }

  function setPreviewBlock(blockId: string | null): void {
    previewBlockId.value = blockId;
  }

  async function loadWorkspaceFromMain(): Promise<void> {
    if (!window.beelite?.loadWorkspace) return;

    const snapshot = await window.beelite.loadWorkspace();
    if (!snapshot) return;

    if (snapshot.nodes.length > 0) {
      applyLiveSnapshot(snapshot);
    } else {
      resetDemoWorkspace();
    }
  }

  async function bootstrap(): Promise<void> {
    if (!window.beelite?.loadWorkspace) {
      resetDemoWorkspace();
      return;
    }
    await refreshStorage();
    await refreshLlmSettings();
    await refreshResearchSettings();
    await loadWorkspaceFromMain();
  }

  async function importChatGpt(): Promise<void> {
    await runImport(() => window.beelite?.importChatGpt() ?? Promise.resolve(null));
  }

  async function importBookmarks(): Promise<void> {
    await runImport(() => window.beelite?.importBookmarks() ?? Promise.resolve(null));
  }

  async function runImport(task: () => Promise<ImportRunResult | null>): Promise<void> {
    importError.value = null;
    importLoading.value = true;
    try {
      const result = await task();
      if (result) {
        lastImportResult.value = result;
        importStats.value = result.stats;
      }
      await refreshStorage();
      await loadWorkspaceFromMain();
    } catch (error) {
      importError.value = error instanceof Error ? error.message : String(error);
    } finally {
      importLoading.value = false;
    }
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
    breadcrumbTrail,
    activeModelRoutes,
    providerTemplates,
    viewport,
    graphProposal,
    importStats,
    importJobs,
    importSources,
    lastImportResult,
    importError,
    importLoading,
    useLiveWorkspace,
    llmSettings,
    researchSettings,
    modelSettingsOpen,
    previewBlockId,
    setPreviewBlock,
    setTool,
    selectBlock,
    moveBlockBy,
    updateBlockBody,
    panBy,
    zoomBy,
    refreshStorage,
    refreshLlmSettings,
    refreshResearchSettings,
    researchSearch,
    researchFetchPage,
    setModelSettingsOpen,
    loadWorkspaceFromMain,
    bootstrap,
    importChatGpt,
    importBookmarks
  };
});
