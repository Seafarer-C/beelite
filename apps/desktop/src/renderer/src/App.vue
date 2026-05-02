<script setup lang="ts">
import { Bell, Plus, Search, UserCircle } from "lucide-vue-next";
import AppSidebar from "./components/AppSidebar.vue";
import CanvasToolbar from "./components/CanvasToolbar.vue";
import KnowledgeCanvas from "./components/KnowledgeCanvas.vue";
import ProviderDock from "./components/ProviderDock.vue";
</script>

<template>
  <div class="app-shell">
    <AppSidebar />

    <main class="workspace-shell">
      <header class="workspace-topbar">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <span>Home</span>
          <span>AI & Machine Learning</span>
          <span>Large Language Models</span>
          <strong>RAG 研究与实践</strong>
        </nav>

        <div class="topbar-actions">
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
      <CanvasToolbar />
      <ProviderDock />
    </main>
  </div>
</template>
