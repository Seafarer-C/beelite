import { createGraphProposal } from "@beelite/graph-engine";
import type { KnowledgeEdge, KnowledgeNode, KnowledgeSource } from "@beelite/shared";
import { compactText, nowIso, secondsToIso, stableId } from "./ids";
import type { ChatGptMessage, ParsedConversation, ParsedImport } from "./types";

interface ChatGptExportConversation {
  id?: string;
  title?: string;
  create_time?: number;
  update_time?: number;
  mapping?: Record<string, ChatGptMappingNode>;
}

interface ChatGptMappingNode {
  id?: string;
  message?: {
    id?: string;
    author?: { role?: string };
    create_time?: number;
    content?: {
      content_type?: string;
      parts?: unknown[];
      text?: string;
    };
  } | null;
}

export function parseChatGptExport(raw: unknown): ParsedConversation[] {
  const conversations = Array.isArray(raw) ? raw : [];

  return conversations
    .map((conversation, index) =>
      parseConversation(conversation as ChatGptExportConversation, index)
    )
    .filter((conversation): conversation is ParsedConversation => conversation.messages.length > 0);
}

export function buildChatGptImport(raw: unknown, filePath?: string): ParsedImport {
  const conversations = parseChatGptExport(raw);
  const createdAt = nowIso();
  const sources: KnowledgeSource[] = conversations.map((conversation) => ({
    id: `source-${conversation.id}`,
    type: "chatgpt_conversation",
    title: conversation.title,
    path: filePath,
    importedAt: createdAt,
    metadata: {
      conversationId: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messages.length,
      userMessageCount: conversation.messages.filter((message) => message.role === "user").length,
      assistantMessageCount: conversation.messages.filter((message) => message.role === "assistant")
        .length
    }
  }));

  const nodes: KnowledgeNode[] = conversations.map((conversation) =>
    createConversationNode(conversation, createdAt)
  );
  const edges: KnowledgeEdge[] = createConversationEdges(nodes, createdAt);
  const proposal = createGraphProposal({
    id: stableId("proposal-chatgpt", [filePath, conversations.length, createdAt]),
    title: "ChatGPT 历史导入知识提议",
    sourceIds: sources.map((source) => source.id),
    nodes,
    edges,
    openQuestions: [
      "这些对话中哪些主题应该提升为一级知识领域？",
      "哪些重复问题可以合并为长期研究线索？"
    ],
    warnings:
      conversations.length === 0
        ? ["没有解析到有效对话，请确认文件是 ChatGPT conversations.json。"]
        : []
  });

  return {
    kind: "chatgpt",
    title: "ChatGPT conversations.json",
    sources,
    nodes,
    edges,
    proposal,
    warnings: proposal.warnings
  };
}

function parseConversation(
  conversation: ChatGptExportConversation,
  index: number
): ParsedConversation {
  const title = compactText(conversation.title || `Untitled conversation ${index + 1}`, 120);
  const id = stableId("chatgpt", [conversation.id, title, conversation.create_time, index]);
  const mapping = conversation.mapping ?? {};
  const messages = Object.values(mapping)
    .map((node, messageIndex) => parseMessage(node, messageIndex))
    .filter((m): m is ChatGptMessage => m !== null && m.text.length > 0);

  messages.sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return leftTime - rightTime;
  });

  return {
    id,
    title,
    createdAt: secondsToIso(conversation.create_time),
    updatedAt: secondsToIso(conversation.update_time),
    messages
  };
}

function parseMessage(node: ChatGptMappingNode, index: number): ChatGptMessage | null {
  const message = node.message;
  if (!message) return null;

  const role = message.author?.role ?? "unknown";
  const text = extractContentText(message.content ?? {});
  if (text.length === 0) return null;

  return {
    id: stableId("chatgpt-message", [message.id, role, index, text.slice(0, 80)]),
    role,
    text,
    createdAt: secondsToIso(message.create_time)
  };
}

function extractContentText(content: ChatGptMappingNode["message"] extends infer Message
  ? Message extends { content?: infer Content }
    ? Content
    : never
  : never): string {
  if (!content) return "";
  if (typeof content.text === "string") return compactText(content.text, 4000);

  const parts = Array.isArray(content.parts) ? content.parts : [];
  return compactText(
    parts
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part === "number") return String(part);
        if (part && typeof part === "object" && "text" in part) {
          const maybeText = (part as { text?: unknown }).text;
          return typeof maybeText === "string" ? maybeText : "";
        }
        return "";
      })
      .join("\n"),
    4000
  );
}

function createConversationNode(conversation: ParsedConversation, createdAt: string): KnowledgeNode {
  const userQuestions = conversation.messages
    .filter((message) => message.role === "user")
    .map((message) => message.text)
    .slice(0, 3);
  const assistantAnswers = conversation.messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.text)
    .slice(0, 2);
  const summarySeed = userQuestions.length > 0 ? userQuestions.join(" / ") : assistantAnswers.join(" / ");

  return {
    id: `node-${conversation.id}`,
    type: "topic",
    title: conversation.title,
    summary: compactText(summarySeed || "ChatGPT 对话导入的知识主题。", 260),
    content: compactText(
      conversation.messages
        .slice(0, 12)
        .map((message) => `${message.role}: ${message.text}`)
        .join("\n\n"),
      8000
    ),
    confidence: 0.62,
    importance: Math.min(0.95, 0.45 + conversation.messages.length / 80),
    freshness: 0.72,
    createdAt,
    updatedAt: createdAt,
    sourceRefs: [`source-${conversation.id}`],
    tags: inferTags(conversation),
    aliases: [],
    relationIds: [],
    spaceIds: ["space-root"],
    metadata: {
      importer: "chatgpt",
      messageCount: conversation.messages.length,
      conversationCreatedAt: conversation.createdAt,
      conversationUpdatedAt: conversation.updatedAt
    }
  };
}

function createConversationEdges(nodes: KnowledgeNode[], createdAt: string): KnowledgeEdge[] {
  const edges: KnowledgeEdge[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const current = nodes[index];
    const next = nodes[index + 1];
    if (!next) continue;

    const sharedTags = current.tags.filter((tag) => next.tags.includes(tag));
    if (sharedTags.length === 0) continue;

    edges.push({
      id: stableId("edge-chatgpt", [current.id, next.id, sharedTags.join(",")]),
      sourceId: current.id,
      targetId: next.id,
      relationType: "related_to",
      weight: Math.min(0.9, 0.42 + sharedTags.length * 0.12),
      confidence: 0.48,
      evidenceRefs: current.sourceRefs.map((sourceId) => ({ sourceId, confidence: 0.46 })),
      createdBy: "system",
      createdAt
    });
  }

  return edges;
}

function inferTags(conversation: ParsedConversation): string[] {
  const text = `${conversation.title} ${conversation.messages
    .slice(0, 8)
    .map((message) => message.text)
    .join(" ")}`.toLowerCase();
  const candidates: Array<[string, string[]]> = [
    ["AI", ["ai", "llm", "agent", "rag", "模型", "大模型"]],
    ["Code", ["typescript", "vue", "react", "python", "代码", "debug"]],
    ["Design", ["design", "figma", "品牌", "视觉", "ui", "ux"]],
    ["Research", ["research", "论文", "调研", "分析", "study"]],
    ["Business", ["startup", "商业", "产品", "增长", "用户"]]
  ];

  return candidates
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([tag]) => tag)
    .slice(0, 4);
}
