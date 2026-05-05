<script setup lang="ts">
import { Bell, Bookmark, FlaskConical, Plus, Search, Settings2, UserCircle } from "lucide-vue-next";
import { onMounted, onUnmounted, ref } from "vue";
import AppSidebar from "./components/AppSidebar.vue";
import CanvasToolbar from "./components/CanvasToolbar.vue";
import BlockPreviewOverlay from "./components/BlockPreviewOverlay.vue";
import KnowledgeCanvas from "./components/KnowledgeCanvas.vue";
// import ResearchPanel from "./components/ResearchPanel.vue";
import BookmarksTestPage from "./pages/BookmarksTestPage.vue";
import ResearchTestPage from "./pages/ResearchTestPage.vue";
import { useWorkspaceStore } from "./stores/workspace";

const workspace = useWorkspaceStore();

/** 模板中不能直接使用 import.meta，需通过脚本常量注入 */
const isDev = import.meta.env.DEV;

const researchTestMode = ref(false);
const bookmarksTestMode = ref(false);

function syncDevTestPageFromHash(): void {
  const h = window.location.hash.replace(/^#\/?/, "");
  researchTestMode.value = h === "research-test";
  bookmarksTestMode.value = h === "bookmarks-test";
}

function exitDevTestPage(): void {
  window.location.hash = "";
  syncDevTestPageFromHash();
}

function openResearchTest(): void {
  window.location.hash = "#research-test";
}

function openBookmarksTest(): void {
  window.location.hash = "#bookmarks-test";
}

onMounted(() => {
  syncDevTestPageFromHash();
  window.addEventListener("hashchange", syncDevTestPageFromHash);
  void workspace.bootstrap();
});

onUnmounted(() => {
  window.removeEventListener("hashchange", syncDevTestPageFromHash);
});
</script>

<template>
  <ResearchTestPage v-if="researchTestMode" @exit="exitDevTestPage" />
  <BookmarksTestPage v-else-if="bookmarksTestMode" @exit="exitDevTestPage" />
  <div v-else class="app-shell">
    <AppSidebar />

    <main class="workspace-shell">
      <header class="workspace-topbar">
        <nav class="breadcrumb" aria-label="面包屑导航">
          <span class="breadcrumb-home">首页</span>
          <template v-for="(crumb, index) in workspace.breadcrumbTrail" :key="crumb.id">
            <span
              class="breadcrumb-segment"
              :class="{
                'breadcrumb-segment--collapse':
                  workspace.breadcrumbTrail.length > 1 &&
                  index < workspace.breadcrumbTrail.length - 1
              }"
            >
              <span class="breadcrumb-sep" aria-hidden="true">/</span>
              <strong v-if="index === workspace.breadcrumbTrail.length - 1">{{ crumb.title }}</strong>
              <span v-else>{{ crumb.title }}</span>
            </span>
          </template>
        </nav>

        <div class="topbar-actions">
          <button
            v-if="isDev"
            class="icon-button"
            type="button"
            aria-label="打开 Research 测试页"
            title="Research 测试页（hash #research-test）"
            @click="openResearchTest"
          >
            <FlaskConical :size="18" />
          </button>
          <button
            v-if="isDev"
            class="icon-button"
            type="button"
            aria-label="打开浏览器收藏夹拉取测试页"
            title="浏览器收藏夹本地拉取测试（hash #bookmarks-test）"
            @click="openBookmarksTest"
          >
            <Bookmark :size="18" />
          </button>
          <button
            class="icon-button"
            type="button"
            aria-label="模型与 API 配置"
            title="模型与 API 配置"
            @click="workspace.setModelSettingsOpen(true)"
          >
            <Settings2 :size="18" />
          </button>
          <button class="icon-button" type="button" aria-label="搜索">
            <Search :size="18" />
          </button>
          <button class="new-button" type="button">
            <Plus :size="17" />
            New
          </button>
          <button class="icon-button" type="button" aria-label="通知">
            <Bell :size="18" />
          </button>
          <button class="avatar-button" type="button" aria-label="账户">
            <UserCircle :size="28" />
          </button>
        </div>
      </header>

      <KnowledgeCanvas />
      <BlockPreviewOverlay />
      <!-- <ResearchPanel /> -->
      <!-- <ImportPanel /> -->
      <CanvasToolbar />
      <!-- <ProviderDock /> -->
    </main>
  </div>
</template>
