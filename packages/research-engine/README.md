# @beelite/research-engine

联网搜索（HTTP API + 无头浏览器 HTML 解析）与基于 CDP 的正文抓取。供 **Electron 主进程**或其它 Node 环境调用；**不含** UI、IPC 与持久化（后者在 `apps/desktop` 的 `ResearchSettingsStore` 中）。

## 文档

- **[API 结构与约定](./docs/API.md)** — 导出函数、入参/出参、错误与调试字段说明。

## 依赖

- `@beelite/shared`：领域类型 `ResearchHit`、`ResearchSearchProviderKind` 等。
- `playwright`：浏览器模式与 `fetchPageTextViaCdp`；打包时需将 `playwright` / `playwright-core` 保持为 **external**（见 `apps/desktop/electron.vite.config.ts`）。

## 安装 Chromium（本机）

```bash
pnpm exec playwright install chromium
```
