import { apiRequest } from "../lib/api";
import type { CaseDigest, SourceItem, StreamTrace } from "../streamChat";

export type ConversationChatMode =
  | "judgment"
  | "drafting_studio"
  | "argument";

export type ConversationListItem = {
  id: string;
  title: string;
  chatMode: ConversationChatMode;
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
    chatMode: ConversationChatMode;
    createdAt: string;
    updatedAt: string;
  };
};

type MessagesResponse = {
  ok: boolean;
  conversation: {
    id: string;
    title: string;
    chatMode: ConversationChatMode;
  };
  messages: ConversationMessage[];
};

export const conversationService = {
  list(chatMode?: ConversationChatMode) {
    const params = new URLSearchParams();

    if (chatMode) {
      params.set("chatMode", chatMode);
    }

    const query = params.toString();
    const url = query ? `/api/conversations?${query}` : "/api/conversations";

    return apiRequest<ListResponse>(url, {
      method: "GET",
    });
  },

  create(
    title = "New chat",
    chatMode: ConversationChatMode = "judgment"
  ) {
    return apiRequest<CreateResponse>("/api/conversations", {
      method: "POST",
      body: { title, chatMode },
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