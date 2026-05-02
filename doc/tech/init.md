# PI-Agent 完整技术方案（基于 Vue + Whiteboard Architecture + pi-mono）

---

# 1. 系统定位

PI-Agent 不是：

```txt
AI Chat App
```

也不是：

```txt
Graph Visualization Tool
```

而是：

```txt
AI Native Cognitive Operating System
```

系统核心：

```txt
Whiteboard-based Knowledge Space
```

即：

* 用户在空间中思考
* AI 在空间中研究
* 知识在空间中演化

而不是：

```txt
文件夹 + 聊天窗口
```

---

# 2. 核心架构思想（极重要）

系统分为：

```txt
Interaction Layer
Semantic Layer
Agent Layer
Memory Layer
```

---

# 架构关系

```txt
┌────────────────────────────────────┐
│          User Interaction Layer    │
│                                    │
│  Whiteboard / Spatial Navigation   │
│                                    │
├────────────────────────────────────┤
│          Semantic Layer            │
│                                    │
│  Knowledge Graph / Space Mapping   │
│                                    │
├────────────────────────────────────┤
│           Agent Layer              │
│                                    │
│  Research / AI Copilot / Runtime   │
│                                    │
├────────────────────────────────────┤
│           Memory Layer             │
│                                    │
│  SQLite / Vector / Snapshots       │
│                                    │
└────────────────────────────────────┘
```

---

# 3. 技术栈（最终建议）

# Desktop Runtime

```txt
Electron
```

---

# Frontend

```txt
Vue 3
TypeScript
Vite
Pinia
VueUse
```

---

# Whiteboard Engine

```txt
DOM-based Infinite Whiteboard
```

---

# Interaction Libraries

```txt
Moveable
Selecto
Floating UI
```

---

# Visualization

```txt
AntV G6
AntV X6
```

---

# AI Runtime

```txt
pi-mono
```

---

# Browser Automation

```txt
Playwright + CDP
```

---

# Storage

```txt
SQLite
LanceDB
Local File Storage
```

---

# Embedding

```txt
OpenAI Embedding
BGE-M3
Ollama Embedding
```

---

# 4. Monorepo 架构（重要）

必须模块化。

---

# 推荐结构

```txt
/apps
  /desktop

/packages

  /whiteboard-engine
  /graph-engine
  /research-engine
  /space-engine
  /agent-runtime
  /visualization-engine
  /storage-engine
  /llm-engine
  /interaction-engine
  /shared
```

---

# 为什么必须模块化

因为：

```txt
复杂度会指数爆炸
```

尤其：

* AI
* whiteboard
* graph
* research

会高度耦合。

---

# 5. Electron 架构（重要）

---

# Main Process

负责：

```txt
filesystem
database
agent runtime
browser automation
heavy tasks
```

---

# Renderer Process

负责：

```txt
UI
whiteboard
interaction
rendering
```

---

# Worker Layer

必须有：

```txt
background workers
```

用于：

```txt
embedding
graph indexing
research parsing
layout calculation
```

---

# IPC Architecture

不要乱传消息。

必须：

```txt
typed ipc layer
```

例如：

```ts
interface IPCEvents {
  'graph:getNode': {}
  'research:start': {}
  'space:update': {}
}
```

---

# 6. Whiteboard Engine（核心）

这是整个系统核心。

---

# 6.1 Whiteboard 本质

不是：

```txt
绘图工具
```

而是：

```txt
Spatial Thinking System
```

---

# 6.2 核心能力

必须支持：

```txt
infinite canvas
spatial navigation
free positioning
semantic zoom
grouping
drawing
annotation
AI overlays
```

---

# 6.3 Whiteboard 架构

```txt
Viewport Engine
    ↓
Spatial Index
    ↓
Node Lifecycle
    ↓
Block Renderer
    ↓
Interaction Layer
```

---

# 6.4 核心数据结构

```ts
interface BoardNode {
  id: string

  type: string

  x: number
  y: number

  width: number
  height: number

  rotation: number

  zIndex: number

  content: any

  metadata: {}

  relations: string[]
}
```

---

# 6.5 Viewport Engine

必须支持：

```txt
pan
zoom
inertia
smooth navigation
```

---

# 关键

不要：

```txt
transform entire DOM tree
```

---

# 推荐

```txt
virtualized spatial rendering
```

---

# 6.6 Spatial Index（重要）

必须建立：

```txt
R-tree spatial index
```

用于：

```txt
visible node detection
selection
collision
lazy rendering
```

---

# 6.7 Node Virtualization（极重要）

不要渲染全部节点。

---

# 机制

```txt
viewport query
    ↓
visible nodes
    ↓
mount nodes
```

---

# 6.8 Semantic Zoom（核心）

不同缩放层级：

显示不同信息。

---

# 示例

```txt
zoom out
→ topic level

zoom in
→ detailed research
```

---

# 6.9 Whiteboard Block System

核心思想：

```txt
everything is a block
```

---

# Block Types

```txt
markdown
knowledge
research
graph
timeline
image
AI insight
browser snapshot
video
```

---

# 6.10 Block Renderer

```txt
Block Registry
    ↓
Dynamic Renderer
```

---

# 示例

```ts
registry.register('markdown', MarkdownBlock)
```

---

# 7. Interaction Engine（核心）

---

# 7.1 Selection System

支持：

```txt
multi select
lasso select
semantic select
```

---

# 7.2 Move System

支持：

```txt
snap
align
group move
smart guides
```

---

# 7.3 AI Interaction

例如：

```txt
圈选区域
→ AI restructure
```

---

# 7.4 Context Menu System

AI 操作：

```txt
summarize
cluster
merge
research deeper
```

---

# 8. Knowledge Graph Engine

这是 semantic layer。

---

# 8.1 Graph ≠ UI

重要：

```txt
graph 不直接渲染
```

---

# graph 作用

```txt
semantic relationships
knowledge evolution
reasoning support
```

---

# 8.2 Graph Schema

---

# Nodes

```ts
interface KnowledgeNode {
  id: string

  type: string

  title: string

  summary: string

  embedding: number[]

  confidence: number

  metadata: {}
}
```

---

# Edges

```ts
interface KnowledgeEdge {
  source: string
  target: string

  relation: string

  weight: number
}
```

---

# 8.3 Graph Evolution

必须支持：

```txt
merge
split
compression
decay
```

---

# 9. Space Engine（关键）

这是：

```txt
knowledge → spatial world
```

映射层。

---

# 9.1 Space Definition

```ts
interface Space {
  id: string

  title: string

  nodeIds: string[]

  viewport: {}

  layout: {}
}
```

---

# 9.2 空间层级

```txt
root space
topic space
research space
temporary exploration
```

---

# 9.3 Spatial Memory

关键：

```txt
空间布局必须稳定
```

否则用户失去认知地图。

---

# 10. Visualization Engine

---

# 核心思想

AntV 不是主系统。

只是：

```txt
visualization blocks
```

---

# 支持：

```txt
mindmap
force graph
timeline
dependency graph
```

---

# AI 输出：

```json
{
  "type": "mindmap",
  "nodes": [],
  "edges": []
}
```

---

# 11. Research Engine（第二核心）

---

# 11.1 目标

实现：

```txt
autonomous research
```

---

# 11.2 架构

```txt
Research Planner
    ↓
Search Agent
    ↓
Browser Reader
    ↓
Knowledge Extractor
    ↓
Research Synthesizer
```

---

# 11.3 Browser Agent

基于：

```txt
Playwright
```

---

# 能力

```txt
open page
scroll
extract
screenshot
```

---

# 11.4 Research Memory

避免：

```txt
重复研究
```

---

# 12. AI Copilot System

---

# 功能

用户操作空间时：

AI 实时辅助。

---

# 示例

```txt
你正在重复创建相似知识块
```

---

# 13. LLM Engine

---

# Provider Layer

支持：

```txt
OpenAI
Claude
Gemini
Ollama
OpenRouter
```

---

# Routing Layer

动态路由。

---

# 示例

| task      | model  |
| --------- | ------ |
| reasoning | Claude |
| JSON      | GPT    |
| local     | Ollama |

---

# 14. Storage Architecture

---

# SQLite

存：

```txt
metadata
graph
spaces
actions
```

---

# LanceDB

存：

```txt
embeddings
```

---

# File Storage

存：

```txt
snapshots
images
imports
```

---

# 15. Memory Compression Engine

必须有。

---

# 原因

长期使用：

```txt
知识爆炸
```

---

# 策略

```txt
summarize
merge
archive
abstract
```

---

# 16. Performance Architecture（极重要）

---

# 风险

```txt
10万节点
```

---

# 必须：

```txt
virtualization
chunk loading
workers
lazy mount
```

---

# 17. Security Architecture

---

# API Keys

必须：

```txt
encrypted locally
```

---

# 用户数据

必须：

```txt
local-first
```

---

# 18. MVP 建议（重要）

不要一开始做太多。

---

# 第一版：

只做：

```txt
Chat Import
Knowledge Graph
Infinite Whiteboard
Research Agent
AI Layout
Breadcrumb Navigation
```

---

# 不做：

```txt
多人协作
实时同步
插件市场
```

---

# 19. 最终系统认知（核心）

你真正构建的：

不是：

```txt
AI 笔记软件
```

而是：

```txt
AI Native Spatial Cognitive Operating System
```

这里的核心竞争力不是：

```txt
聊天
```

而是：

```txt
AI 如何帮助用户构建、演化、导航自己的认知宇宙
```
