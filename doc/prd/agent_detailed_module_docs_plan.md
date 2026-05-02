# 模块化产品文档体系（详细拆解规划）

# 文档 01：Knowledge Ingestion System

## 目标

定义：

```txt
如何从外部世界获取用户知识数据
```

---

## 需要覆盖

### 数据源

- ChatGPT
- Claude
- Gemini
- Browser Bookmarks
- Local Files
- Future Plugins

---

### 数据结构

```txt
Conversation
Bookmark
Research Source
Snippet
Reference
```

---

### 导入模式

- 手动导入
- 自动同步
- Browser Session 抓取
- 本地监听

---

### AI 分析

- Topic Extraction
- Interest Clustering
- Long-term Intent Detection
- Knowledge Gap Detection

---

### 风险

- Token 爆炸
- 重复内容
- 噪声数据
- 隐私风险

---

# 文档 02：Knowledge Graph Engine

## 目标

定义：

```txt
系统如何组织知识
```

这是整个产品核心。

---

## 必须定义

### Graph Schema

```txt
Node
Edge
Cluster
Space
Semantic Relation
Temporal Relation
```

---

### Node 类型

例如：

```txt
Topic
Research
Question
Insight
Concept
Code
Person
Technology
Timeline Event
```

---

### Relation 类型

例如：

```txt
related_to
causes
depends_on
contradicts
inspired_by
sub_topic_of
```

---

### 图谱演化规则

- merge
- split
- compress
- decay
- relevance update

---

### AI Graph Builder

定义：

```txt
LLM 如何生成知识关系
```

---

# 文档 03：Infinite Canvas Engine

## 目标

定义：

```txt
无限知识空间如何工作
```

---

## 需要定义

### Space System

```txt
Root Space
Sub Space
Research Space
Temporary Space
```

---

### Navigation

- Breadcrumb
- Zoom Navigation
- Spatial Jump
- Semantic Jump

---

### Viewport System

- virtual render
- culling
- lazy loading

---

### Performance Strategy

解决：

```txt
10万节点
```

问题。

---

### Whiteboard Layer

支持：

- drawing
- annotation
- comments
- grouping
- pinning

---

# 文档 04：AI Research Engine

这是最重要文档之一。

---

## 目标

定义：

```txt
AI 如何进行真实 Research
```

而不是简单搜索。

---

## 必须定义

### Research Lifecycle

```txt
Question
 → Search
 → Read
 → Summarize
 → Find Gaps
 → New Questions
 → Iterate
```

---

### Search Strategy

- broad search
- deep search
- contradiction search
- source validation

---

### Browser Agent

- open page
- scroll
- detect article
- extract content
- screenshot

---

### Source Quality System

AI 如何判断：

```txt
哪个来源可信
```

---

### Research Memory

避免：

```txt
重复研究
```

---

### Research Output Schema

例如：

```json
{
  "claim": [],
  "evidence": [],
  "counterArguments": [],
  "unknowns": []
}
```

---

# 文档 05：AI Agent Runtime System

## 目标

定义：

```txt
本地 Agent 如何运行
```

---

## 模块

### Agent Types

- Research Agent
- Summarization Agent
- Graph Builder Agent
- Layout Agent
- Memory Compression Agent

---

### Tool System

Agent 如何调用：

- browser
- filesystem
- vector db
- graph db
- search

---

### Multi-Agent Coordination

是否采用：

```txt
Planner + Executor
```

架构。

---

# 文档 06：Markdown + Visualization Rendering System

## 目标

定义：

```txt
知识内容如何渲染
```

---

## 必须定义

### Block System

```txt
Markdown Block
Graph Block
Chart Block
Research Block
Code Block
AI Block
```

---

### AI Visualization Pipeline

LLM 输出：

```json
{
  "visualization": {}
}
```

如何变成：

```txt
AntV Graph
```

---

### Layout System

- auto layout
- semantic layout
- manual override

---

# 文档 07：LLM Provider System

## 目标

定义：

```txt
多模型接入与调度
```

---

## 必须定义

### Provider Layer

- OpenAI
- Anthropic
- Gemini
- Ollama
- OpenRouter

---

### Routing Strategy

例如：

```txt
长文本 → Claude
结构化输出 → GPT
本地隐私 → Ollama
```

---

### Token Budget System

避免：

```txt
用户 API 爆炸扣费
```

---

# 文档 08：Memory & Compression System

## 目标

定义：

```txt
长期记忆如何存活
```

---

## 核心问题

如果用户用了两年：

```txt
数据会无限膨胀
```

---

## 需要定义

### Memory Layers

```txt
Working Memory
Long-term Memory
Archived Memory
Compressed Memory
```

---

### Compression Strategy

- summarize
- merge
- archive
- decay

---

# 文档 09：Local Storage Architecture

## 目标

定义：

```txt
本地数据存储系统
```

---

## 必须定义

### 数据库划分

| 数据 | 存储 |
|---|---|
| metadata | sqlite |
| embeddings | lancedb |
| graph | graph storage |
| cache | local cache |

---

### Sync Strategy

未来是否支持：

```txt
本地多设备同步
```

---

# 文档 10：Interaction & UX System

## 目标

定义：

```txt
用户如何与 AI 知识空间互动
```

---

## 必须定义

### Interaction Modes

- explore mode
- research mode
- edit mode
- focus mode

---

### AI Interactions

例如：

```txt
“帮我整理这块区域”
```

AI 如何响应。

---

# 文档 11：Performance Architecture

## 目标

定义：

```txt
如何保证桌面端性能
```

---

## 关键问题

### Graph Explosion

### GPU Rendering

### Memory Leak

### Incremental Loading

---

# 文档 12：Security & Privacy System

这是极重要模块。

---

## 目标

定义：

```txt
如何保证用户本地隐私安全
```

---

## 必须定义

### Local-first Architecture

### API Key Encryption

### Browser Permission System

### Data Isolation

### Sensitive Content Detection

---

# 2. 推荐文档编写顺序（非常重要）

不要先做 UI。

建议顺序：

---

## 第一阶段（核心）

必须先完成：

```txt
01 Knowledge Ingestion
02 Knowledge Graph Engine
04 Research Engine
05 Agent Runtime
```

因为：

```txt
这是产品灵魂
```

---

## 第二阶段（空间系统）

然后做：

```txt
03 Infinite Canvas
06 Rendering System
10 UX System
```

---

## 第三阶段（长期运行）

最后做：

```txt
08 Memory System
11 Performance
12 Security
```

---

# 3. 强烈建议（关键）

你这个产品最容易失败的地方：

不是技术。

而是：

```txt
AI 会把知识空间变成垃圾堆
```

所以必须提前定义：

- knowledge quality system
- graph confidence
- contradiction detection
- duplicate merge
- semantic cleanup

否则半年后：

```txt
知识图谱会完全失控
```

---

# 4. 下一步建议

建议下一轮开始：

```txt
先深度拆解：

文档 02：Knowledge Graph Engine
```

因为这是整个系统核心。

如果 Graph Schema 设计错误：

后面所有模块都会崩。

