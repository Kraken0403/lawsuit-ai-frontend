import { apiRequest } from "../lib/api";

export type DraftAttachment = {
  id: string;
  conversationId: string | null;
  templateId: string | null;
  fileName: string;
  mimeType: string;
  storageUrl: string | null;
  extractedText: string | null;
  parsedJson: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

type UploadDraftAttachmentPayload = {
  conversationId?: string | null;
  fileName: string;
  mimeType: string;
  text: string;
  parsedJson?: Record<string, unknown> | null;
};

type SaveAsTemplatePayload = {
  title?: string;
  family?: string;
  subtype?: string;
  summary?: string;
  tags?: string[];
};

export const draftAttachmentService = {
  upload(payload: UploadDraftAttachmentPayload) {
    return apiRequest<{
      ok: true;
      attachment: DraftAttachment;
    }>("/api/drafting/uploads", {
      method: "POST",
      body: payload,
    });
  },

  list(conversationId?: string | null) {
    const query = conversationId
      ? `?${new URLSearchParams({ conversationId }).toString()}`
      : "";

    return apiRequest<{
      ok: true;
      attachments: DraftAttachment[];
    }>(`/api/drafting/uploads${query}`, {
      method: "GET",
    });
  },

  get(id: string) {
    return apiRequest<{
      ok: true;
      attachment: DraftAttachment;
    }>(`/api/drafting/uploads/${id}`, {
      method: "GET",
    });
  },

  saveAsTemplate(id: string, payload?: SaveAsTemplatePayload) {
    return apiRequest<{
      ok: true;
      template: unknown;
      attachment: DraftAttachment;
    }>(`/api/drafting/uploads/${id}/save-as-template`, {
      method: "POST",
      body: payload || {},
    });
  },
};