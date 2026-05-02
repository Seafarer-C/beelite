import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

/** Workspace packages use TS path exports; bundle them so Node does not load bare `.ts` at runtime. */
const bundledWorkspaceDeps = [
  "@beelite/graph-engine",
  "@beelite/ingestion-engine",
  "@beelite/llm-engine",
  "@beelite/research-engine",
  "@beelite/shared",
  "@beelite/space-engine",
  "@beelite/storage-engine",
  "@beelite/whiteboard-engine"
];

/** Native / dynamic runtime deps：必须由 Node 从 node_modules 加载，不可打进 main bundle */
const mainExternals = ["playwright", "playwright-core"] as const;

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: [...mainExternals]
      }
    },
    plugins: [externalizeDepsPlugin({ exclude: bundledWorkspaceDeps })]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: "src/renderer",
    resolve: {
      alias: {
        "@": resolve("src/renderer/src")
      }
    },
    plugins: [vue()]
  }
});
