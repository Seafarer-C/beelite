import type {
  GraphProposal,
  ImportKind,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeSource
} from "@beelite/shared";

export interface ParsedImport {
  kind: ImportKind;
  title: string;
  sources: KnowledgeSource[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  proposal: GraphProposal;
  warnings: string[];
}

export interface ChatGptMessage {
  id: string;
  role: string;
  text: string;
  createdAt?: string;
}

export interface ParsedConversation {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  messages: ChatGptMessage[];
}

export interface ParsedBookmark {
  id: string;
  title: string;
  url: string;
  folderPath: string[];
  addedAt?: string;
}

export interface ParsedBookmarkFolder {
  id: string;
  title: string;
  folderPath: string[];
  addedAt?: string;
  childrenCount: number;
}
