# 桌面端知识地图系统

## 1. 产品概述

一款 AI 驱动的个人认知操作系统，它能够自动将你的 AI 对话、收藏内容与研究过程演化为一个可探索、可研究、可无限延展的知识空间宇宙。
---

## 2. 产品定位

一款基于本地桌面端运行的大模型知识构建系统。

产品通过接入用户已有的 AI 对话历史（ChatGPT / Claude / Gemini）、浏览器收藏夹、网页研究内容、用户手工输入内容等数据源，自动生成用户的“知识地图（Knowledge Map）”。

整个产品不是传统线性笔记工具，而是：

- 无限向下扩展的知识画布
- 分层级知识空间（Knowledge Space）
- AI 驱动的研究型知识网络
- 可视化知识探索系统
- AI + 人类协同编辑的智能白板

核心目标：

> 让用户的长期认知资产，变成可探索、可演化、可研究、可推理的知识空间。

---

# 3. 核心产品理念

## 3.1 与传统知识库的区别

| 传统知识库 | 本产品 |
|---|---|
| 文档树结构 | 无限画布结构 |
| 静态分类 | 动态知识图谱 |
| 用户手工整理 | AI 自动聚类与演化 |
| 单文档阅读 | 空间式探索 |
| 笔记导向 | Research 导向 |
| 搜索为核心 | 关系发现为核心 |
| 扁平内容 | 多层级知识宇宙 |

---

## 3.2 核心体验

用户打开系统后，不是看到文件夹。

而是看到：

```txt
[AI]
[创业]
[计算机图形学]
[品牌设计]
[WebGL]
[商业模式]
[历史]
[产品思维]
```

这些是 AI 从用户历史行为中自动抽取的“一级知识领域”。

点击其中一个：

```txt
WebGL
 ├── Shader
 ├── GPU Pipeline
 ├── 纹理系统
 ├── FFD
 ├── 图像变形
 ├── Three.js
 └── WebGPU
```

继续深入：

```txt
FFD
 ├── Bezier FFD
 ├── Cage Deformation
 ├── Mesh Warp
 ├── Image Distortion
 └── OpenGL 实现
```

每一层都是新的无限画布。

用户通过：

- 面包屑导航
- 缩放
- 空间跳转
- AI 自动扩展

来探索自己的知识宇宙。

---

# 4. 核心功能设计

# 4.1 数据接入层（Knowledge Ingestion）

## 目标

自动构建用户初始知识地图。

---

## 4.1.1 ChatGPT 对话历史导入

### 来源

用户导出的 ChatGPT conversations.json

或者：

通过浏览器 Cookie + 本地自动化抓取。

---

### 提取内容

- 对话标题
- 用户问题
- AI 回答
- 时间
- 标签
- 高频主题
- 代码片段
- URL

---

### AI 分析目标

提取：

```txt
主题
兴趣方向
长期研究领域
技术栈
重复问题
未完成探索
```

---

## 4.1.2 Claude 历史导入

支持：

- Claude 导出数据
- 本地浏览器 Session 抓取

提取：

- Artifact
- 长文本分析
- 深度研究内容

---

## 4.1.3 Gemini 历史导入

支持：

- 导出 JSON
- 浏览器自动化抓取

---

## 4.1.4 浏览器收藏夹导入

参考：

- spool.pro

支持：

- Chrome
- Edge
- Arc
- Brave
- Safari（后期）

---

### 自动分析能力

AI 分析收藏夹：

```txt
这个用户长期关注：
- AI Agent
- WebGL
- 电商系统
- 认知科学
- 品牌设计
```

并自动生成领域节点。

---

## 4.1.5 本地文件导入

支持：

- Markdown
- PDF
- txt
- code
- notion export

后期：

- Obsidian Vault
- Roam Research

---

# 4.2 知识地图生成引擎

## 核心目标

将离散信息转化为：

- 主题
- 层级
- 关系
- 时间演化
- 推理路径

---

## 4.2.1 知识抽取 Pipeline

```txt
原始数据
  ↓
Chunking
  ↓
Embedding
  ↓
主题聚类
  ↓
实体抽取
  ↓
关系构建
  ↓
Knowledge Graph
  ↓
空间布局生成
```

---

## 4.2.2 LLM 分析能力

AI 需要生成：

```json
{
  "domain": "WebGL",
  "subDomains": [
    "Shader",
    "FFD",
    "Texture",
    "GPU"
  ],
  "relationships": [],
  "openQuestions": [],
  "knowledgeGaps": []
}
```

---

## 4.2.3 长期记忆结构

系统不是简单向量库。

而是：

```txt
Knowledge Space
  ├── Semantic Graph
  ├── Temporal Graph
  ├── Interest Graph
  ├── Research Graph
  └── User Intent Graph
```

---

# 4.3 无限画布系统（核心体验）

## 核心理念

整个产品本质上是：

```txt
无限嵌套知识空间
```

类似：

- flipbook.page
- tldraw
- FigJam
- Miro

但增加：

- AI 自动生成
- AI 自动布局
- AI 自动研究
- AI 自动扩展知识层级

---

## 4.3.1 空间结构

```txt
Root Space
 ├── AI
 │    ├── Agents
 │    ├── LLM
 │    └── RAG
 │
 ├── Design
 │    ├── Branding
 │    └── Typography
 │
 └── Graphics
      ├── WebGL
      └── FFD
```

每个节点都可以：

- 进入子空间
- 展开关联研究
- 自动生成图谱

---

## 4.3.2 面包屑导航

示例：

```txt
Home > Graphics > WebGL > FFD > Mesh Warp
```

点击任意层级可返回。

---

## 4.3.3 无限缩放

支持：

- Zoom In
- Zoom Out
- Mini Map
- Overview Mode

用户可以从：

```txt
人生知识宇宙
```

缩放到：

```txt
某个具体研究问题
```

---

## 4.3.4 AI 自动布局

支持布局：

- Force Graph
- Mindmap
- Radial
- Timeline
- Cluster Layout
- Tree Layout

用户可切换。

---

# 4.4 Markdown + Visualization 渲染系统

## 核心设计

画布中的节点本质是：

```txt
Markdown Block
+ Visualization Block
+ Interactive Block
```

---

## 4.4.1 Markdown 渲染

支持：

- 标题
- 数学公式
- Mermaid
- Code Block
- 引用
- Callout

---

## 4.4.2 AI 图表生成

参考：

- gpt-vis.antv.vision

LLM 输出：

```json
{
  "type": "mindmap",
  "nodes": [],
  "edges": []
}
```

系统自动渲染：

- G6
- X6
- Graphin
- Charts

---

## 4.4.3 图表类型

支持：

| 类型 | 用途 |
|---|---|
| Mindmap | 知识结构 |
| Force Graph | 关系探索 |
| Timeline | 历史演化 |
| Tree Graph | 层级知识 |
| Flowchart | 推理流程 |
| Dependency Graph | 技术依赖 |
| Research Graph | 研究路径 |

---

# 4.5 智能白板系统

## 用户操作能力

用户可以：

- 拖拽节点
- 调整布局
- 添加批注
- 涂鸦
- 连接关系
- 高亮区域
- 锁定节点

---

## AI 协同能力

用户圈选一块区域：

```txt
“帮我重新组织这些内容”
```

AI 自动：

- 聚类
- 总结
- 重新布局
- 添加关系

---

## AI Research Mode

用户输入：

```txt
研究：WebGPU 与 WebGL 的未来差异
```

系统自动：

- 联网搜索
- 总结
- 生成研究图谱
- 标记争议点
- 给出延伸问题

---

# 4.6 Research Engine（核心）

这是系统最关键能力。

---

## 约束条件

你不提供云服务。

意味着：

```txt
所有 research 能力必须本地完成
```

---

## 方案设计

### 架构

```txt
Desktop App
   ↓
Local Agent Runtime
   ↓
Browser Automation
   ↓
Search Engine
   ↓
Content Extraction
   ↓
LLM Summarization
   ↓
Knowledge Graph Update
```

---

## 4.6.1 联网搜索能力

支持：

- Google
- Bing
- Brave Search
- Tavily（可选）
- Exa（用户自己配置）

---

## 4.6.2 Browser Agent

建议：

- Playwright
- Chrome DevTools Protocol

能力：

- 自动打开网页
- 自动阅读
- 自动滚动
- 自动提取正文
- 多网页研究

---

## 4.6.3 内容提取

提取：

- 正文
- 标题
- 引用
- 图片说明
- code snippet

过滤：

- 广告
- 导航栏
- 垃圾文本

---

## 4.6.4 多轮 Research

AI 不只是搜索。

而是：

```txt
问题
 ↓
搜索
 ↓
阅读
 ↓
发现新问题
 ↓
继续搜索
 ↓
形成研究报告
```

---

## 4.6.5 研究结果结构化

输出：

```txt
核心观点
支持观点
反对观点
争议点
关键人物
关键技术
未来趋势
延伸研究问题
```

并自动生成知识图谱。

---

# 4.7 LLM 管理系统

## 用户自主配置

用户自己配置：

- API Key
- Base URL
- Model

---

## 支持模型

| Provider | Model |
|---|---|
| OpenAI | GPT-4.1 / GPT-5 |
| Anthropic | Claude |
| Google | Gemini |
| OpenRouter | 多模型 |
| Ollama | 本地模型 |
| LM Studio | 本地模型 |

---

## 多模型协同

例如：

| 任务 | 模型 |
|---|---|
| 长文本分析 | Claude |
| 图谱生成 | GPT |
| 本地隐私处理 | Llama |
| 推理任务 | DeepSeek |

---

# 5. 产品架构设计

# 5.1 技术架构

```txt
Electron App
  ├── React Frontend
  ├── Canvas Engine
  ├── Local Agent Runtime
  ├── Knowledge Engine
  ├── Embedding Engine
  ├── Research Engine
  ├── Local Database
  └── LLM Gateway
```

---

# 5.2 前端架构

## 推荐技术栈

| 模块 | 技术 |
|---|---|
| 桌面端 | Electron |
| UI | React |
| 状态管理 | Zustand |
| Canvas | tldraw / ReactFlow / PixiJS |
| Graph | AntV G6 / Graphin |
| Markdown | MDX |
| 富文本 | Lexical |

---

## 为什么不直接使用 DOM

因为：

```txt
无限画布 + 大量节点
```

会导致 DOM 性能崩溃。

建议：

```txt
Canvas/WebGL 渲染层
```

---

# 5.3 本地数据库

建议：

| 类型 | 用途 |
|---|---|
| SQLite | 元数据 |
| LanceDB | 向量检索 |
| Graph Storage | 知识关系 |

---

## 数据结构

### Node

```ts
{
  id,
  title,
  type,
  summary,
  embeddings,
  parentId,
  spaceId,
  metadata
}
```

---

### Edge

```ts
{
  source,
  target,
  relation,
  confidence
}
```

---

# 5.4 Agent Runtime

核心：

```txt
本地 AI Agent 执行系统
```

能力：

- Browser Agent
- Research Agent
- Summarization Agent
- Graph Builder Agent

---

# 6. AI 系统设计

# 6.1 Prompt System

需要标准化输出。

例如：

```txt
你是 Knowledge Architect。
请分析以下内容。
输出 JSON。
```

---

# 6.2 Structured Output

必须强制 JSON Schema。

否则图谱会失控。

---

# 6.3 Knowledge Compression

长期运行后：

```txt
数据量会爆炸
```

需要：

- 自动摘要
- 层级压缩
- 语义合并

---

# 7. 用户体验设计

# 7.1 核心体验原则

## 原则 1

不要像文件管理器。

而像：

```txt
思维宇宙
```

---

## 原则 2

AI 不只是聊天。

AI 是：

```txt
知识组织者
```

---

## 原则 3

用户与 AI 协同编辑。

---

# 7.2 首页体验

打开应用：

```txt
正在分析你的知识世界...
```

然后出现：

```txt
你的主要认知领域：
- AI Agents
- Graphics
- Product Strategy
- WebGL
- Branding
```

---

# 8. MVP 范围

建议第一阶段不要做太大。

---

## Phase 1

### 必做

- ChatGPT 历史导入
- 收藏夹导入
- 一级知识图谱生成
- 无限画布
- 面包屑导航
- AI Research
- Markdown Block
- 基础 Graph Visualization

---

## 不做

- 多人协作
- 云同步
- 实时协同
- 移动端
- 插件生态

---

# 9. 技术难点

# 9.1 最大难点

不是 UI。

而是：

```txt
如何让 AI 长期稳定构建知识结构
```

---

# 9.2 图谱污染问题

AI 会产生：

- 错误关系
- 重复节点
- 虚假总结

需要：

- 去重系统
- confidence system
- user correction feedback

---

# 9.3 无限画布性能

问题：

```txt
10 万节点怎么办？
```

解决：

- viewport virtualization
- level streaming
- lazy render
- graph chunk loading

---

# 9.4 Research 成本控制

因为用户自己提供 API Key。

需要：

- Token 控制
- 深度限制
- Research Budget

---

# 10. 推荐技术方案（重要）

# 10.1 不建议

不要：

```txt
Electron + DOM 无限节点
```

会卡死。

---

# 10.2 推荐方案

## UI

```txt
Electron
 + React
 + PixiJS
 + tldraw
```

---

## Visualization

```txt
AntV G6
```

---

## Agent

```txt
Playwright
 + CDP
```

---

## Local AI

```txt
Ollama Support
```

---

## Storage

```txt
SQLite + LanceDB
```

---

# 11. 未来扩展方向

## 11.1 自动知识演化

AI 自动发现：

```txt
你最近开始关注：
- AI Browser Agent
- WebGPU
- Research Automation
```

---

## 11.2 思维模式分析

分析用户：

- 思维路径
- 决策模式
- 知识偏差

---

## 11.3 自动研究助手

用户输入：

```txt
未来 5 年 WebGPU 是否会取代 WebGL？
```

AI 自动完成完整研究。

---

## 11.4 AI 知识人格

未来可以形成：

```txt
用户数字化认知镜像
```

---

# 12. 最终产品愿景

不是一个笔记软件。

而是：

```txt
个人认知操作系统
```

它能够：

- 理解用户长期兴趣
- 自动组织知识
- 自动研究问题
- 建立知识连接
- 可视化用户认知结构
- 协助用户长期思考

最终形成：

```txt
用户的第二大脑空间宇宙
```

---

# 13. 建议下一步（强烈建议）

在正式开发前，建议先完成：

## Step 1

定义：

```txt
Knowledge Graph Schema
```

这是整个系统核心。

---

## Step 2

定义：

```txt
Space Navigation Model
```

因为你的产品本质是：

```txt
空间系统
```

而不是文档系统。

---

## Step 3

先做：

```txt
Research Agent MVP
```

验证：

```txt
AI 是否真的能持续产出高质量知识结构
```

---

## Step 4

最后再做：

```txt
复杂 UI
```

因为：

```txt
真正难的是知识演化系统
```

不是画布。

---

# 14. 推荐 MVP 技术组合（最终建议）

```txt
Electron
React
Zustand
PixiJS
AntV G6
MDX
Playwright
SQLite
LanceDB
OpenAI SDK
Anthropic SDK
Ollama
```

---

# 15. 一个关键建议（非常重要）

不要把产品做成：

```txt
AI + 无限画布
```

而是：

```txt
AI 驱动的认知空间系统
```

两者差异极大。

真正壁垒不是：

- markdown
- graph
- canvas

而是：

```txt
AI 如何长期构建、维护、演化用户知识宇宙
```

