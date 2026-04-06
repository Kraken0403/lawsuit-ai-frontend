import { apiRequest } from "../lib/api";

export type DraftDocumentListItem = {
  id: string;
  title: string;
  family: string;
  subtype: string | null;
  strategy: string | null;
  matchLevel: string | null;
  status: string;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
  latestVersionNumber?: number;
  latestVersionCreatedAt?: string | null;
};

export type DraftDocumentVersion = {
  id: string;
  draftDocumentId: string;
  versionNumber: number;
  title: string;
  family: string;
  subtype: string | null;
  strategy: string | null;
  matchLevel: string | null;
  sourceTemplateIdsJson?: unknown;
  inputDataJson?: unknown;
  draftingPlanJson?: unknown;
  draftMarkdown: string | null;
  draftHtml: string | null;
  editorJson?: unknown;
  unresolvedPlaceholdersJson?: unknown;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DraftDocument = {
  id: string;
  userId: string;
  conversationId: string | null;
  title: string;
  family: string;
  subtype: string | null;
  strategy: string | null;
  matchLevel: string | null;
  status: string;
  sourceTemplateIdsJson?: unknown;
  inputDataJson?: unknown;
  draftingPlanJson?: unknown;
  draftMarkdown: string | null;
  draftHtml: string | null;
  editorJson?: unknown;
  unresolvedPlaceholdersJson?: unknown;
  createdAt: string;
  updatedAt: string;
  versions?: DraftDocumentVersion[];
};

type DraftDocumentListResponse = {
  ok: boolean;
  documents?: DraftDocumentListItem[];
};

type DraftDocumentSingleResponse = {
  ok: boolean;
  document?: DraftDocument;
};

export const draftDocumentService = {
  async listByConversation(conversationId: string) {
    return await apiRequest<DraftDocumentListResponse>(
      `/api/drafting/documents?conversationId=${encodeURIComponent(conversationId)}`,
      {
        method: "GET",
      }
    );
  },

  async getDocument(id: string) {
    return await apiRequest<DraftDocumentSingleResponse>(
      `/api/drafting/documents/${id}`,
      {
        method: "GET",
      }
    );
  },

  async updateDocument(id: string, payload: Record<string, unknown>) {
    console.log(payload)
    return await apiRequest<DraftDocumentSingleResponse>(
      `/api/drafting/documents/${id}`,
      {
        method: "PATCH",
        body: payload,
      }
    );
  },
};