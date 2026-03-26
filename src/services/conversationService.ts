import { apiRequest } from "../lib/api";
import type { CaseDigest, SourceItem, StreamTrace } from "../streamChat";

export type ConversationListItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
  lastMessageRole: "user" | "assistant" | null;
  lastMessageAt: string;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
  caseDigests?: CaseDigest[];
  trace?: StreamTrace | null;
  createdAt: string;
};

type ListResponse = {
  ok: boolean;
  conversations: ConversationListItem[];
};

type CreateResponse = {
  ok: boolean;
  conversation: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  };
};

type MessagesResponse = {
  ok: boolean;
  conversation: {
    id: string;
    title: string;
  };
  messages: ConversationMessage[];
};

export const conversationService = {
  list() {
    return apiRequest<ListResponse>("/api/conversations", {
      method: "GET",
    });
  },

  create(title = "New chat") {
    return apiRequest<CreateResponse>("/api/conversations", {
      method: "POST",
      body: { title },
    });
  },

  getMessages(conversationId: string) {
    return apiRequest<MessagesResponse>(
      `/api/conversations/${conversationId}/messages`,
      {
        method: "GET",
      }
    );
  },

  rename(conversationId: string, title: string) {
    return apiRequest<CreateResponse>(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      body: { title },
    });
  },
};