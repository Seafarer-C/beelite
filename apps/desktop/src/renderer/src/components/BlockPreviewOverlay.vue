<script setup lang="ts">
import { Clock, Pencil, X } from "lucide-vue-next";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { KnowledgeBlock } from "@beelite/shared";
import { useWorkspaceStore } from "../stores/workspace";

const store = useWorkspaceStore();

const block = computed(
  (): KnowledgeBlock | null =>
    store.previewBlockId
      ? (store.blocks.find((b) => b.id === store.previewBlockId) ?? null)
      : null
);

const mdEditing = ref(false);
const draftBody = ref("");

const title = computed(() => String(block.value?.content.title ?? ""));
const imageSrc = computed(() => {
  const c = block.value?.content;
  if (!c || typeof c.imageSrc !== "string") return "";
  return c.imageSrc;
});
const caption = computed(() => String(block.value?.content.caption ?? ""));
const videoUrl = computed(() => String(block.value?.content.videoUrl ?? ""));
const isStamp = computed(() => block.value?.metadata.variant === "stamp");

const highlights = computed((): string[] => {
  const h = block.value?.content.highlights;
  return Array.isArray(h) ? h.map(String) : [];
});

const bodyHtml = computed(() => {
  const b = block.value;
  if (!b || b.type !== "markdown") return "";
  let t = String(b.content.body ?? "");
  for (const word of highlights.value) {
    if (!word) continue;
    t = t.split(word).join(`<mark class="text-highlight">${word}</mark>`);
  }
  return t.replace(/\n/g, "<br />");
});

watch(
  () => store.previewBlockId,
  (id) => {
    mdEditing.value = false;
    if (!id) return;
    const b = store.blocks.find((x) => x.id === id);
    if (b?.type === "markdown") {
      draftBody.value = String(b.content.body ?? "");
    }
  }
);

function close(): void {
  mdEditing.value = false;
  store.setPreviewBlock(null);
}

function saveMarkdown(): void {
  const b = block.value;
  if (!b || b.type !== "markdown") return;
  store.updateBlockBody(b.id, draftBody.value);
  mdEditing.value = false;
}

function startMarkdownEdit(): void {
  const b = block.value;
  if (!b || b.type !== "markdown") return;
  draftBody.value = String(b.content.body ?? "");
  mdEditing.value = true;
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    if (mdEditing.value) {
      draftBody.value = String(block.value?.content.body ?? "");
      mdEditing.value = false;
      event.preventDefault();
      return;
    }
    close();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onGlobalKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="block"
      class="block-preview-root"
      role="dialog"
      aria-modal="true"
      :aria-label="title || '预览'"
    >
      <div class="block-preview-backdrop" @click="close" />

      <div
        class="block-preview-panel"
        :class="{ 'block-preview-panel--markdown': block.type === 'markdown' }"
        @click.stop
      >
        <header class="block-preview-topbar">
          <h1 class="block-preview-title">{{ title || "预览" }}</h1>
          <div class="block-preview-actions">
            <template v-if="block.type === 'markdown'">
              <button
                v-if="!mdEditing"
                type="button"
                class="block-preview-btn"
                @click="startMarkdownEdit"
              >
                <Pencil :size="16" />
                编辑
              </button>
              <button
                v-else
                type="button"
                class="block-preview-btn block-preview-btn--primary"
                @click="saveMarkdown"
              >
                完成
              </button>
            </template>
            <button
              type="button"
              class="block-preview-icon-btn"
              aria-label="关闭"
              @click="close"
            >
              <X :size="22" />
            </button>
          </div>
        </header>

        <!-- Image -->
        <div v-if="block.type === 'image'" class="block-preview-body block-preview-body--media">
          <div v-if="isStamp && !imageSrc" class="block-preview-stamp-full">
            <div class="block-preview-stamp-fill" />
            <Clock :size="72" class="block-preview-stamp-icon" stroke-width="1.5" />
          </div>
          <template v-else>
            <img class="block-preview-image" :src="imageSrc" alt="" />
            <p v-if="caption" class="block-preview-caption">{{ caption }}</p>
          </template>
        </div>

        <!-- Video -->
        <div v-else-if="block.type === 'video'" class="block-preview-body block-preview-body--media">
          <video
            v-if="videoUrl"
            class="block-preview-video"
            controls
            playsinline
            preload="metadata"
            :src="videoUrl"
          />
          <p v-else class="block-preview-empty">未配置视频地址</p>
        </div>

        <!-- Markdown fullscreen -->
        <div v-else-if="block.type === 'markdown'" class="block-preview-body block-preview-body--markdown">
          <div v-if="!mdEditing" class="block-preview-md-read" v-html="bodyHtml" />
          <textarea
            v-else
            v-model="draftBody"
            class="block-preview-md-editor"
            spellcheck="true"
            rows="1"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
