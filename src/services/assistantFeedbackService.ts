import { apiRequest } from "../lib/api";

export type AssistantFeedbackReaction = "up" | "down" | null;
export type AssistantFeedbackMode =
  | "judgment_mode"
  | "case_modal"
  | "drafting_mode";

export type AssistantMessageFeedback = {
  id: string;
  userId: string | null;
  conversationId: string | null;
  mode: AssistantFeedbackMode;
  caseId: string | null;
  userMessageId: string | null;
  assistantMessageId: string;
  reaction: AssistantFeedbackReaction;
  comment: string;
  fingerprint: string | null;
  createdAt: string;
  updatedAt: string;
};

type GetAssistantMessageFeedbackResponse = {
  ok: boolean;
  feedback: AssistantMessageFeedback | null;
};

type SaveAssistantMessageFeedbackResponse = {
  ok: boolean;
  removed: boolean;
  feedback: AssistantMessageFeedback | null;
};

export const assistantFeedbackService = {
  get(assistantMessageId: string) {
    return apiRequest<GetAssistantMessageFeedbackResponse>(
      `/api/feedback/assistant-message/${encodeURIComponent(assistantMessageId)}`,
      {
        method: "GET",
      }
    );
  },

  save(input: {
    mode: AssistantFeedbackMode;
    assistantMessageId: string;
    userMessageId?: string | null;
    conversationId?: string | null;
    caseId?: string | null;
    reaction?: AssistantFeedbackReaction;
    comment?: string | null;
    fingerprint?: string | null;
  }) {
    return apiRequest<SaveAssistantMessageFeedbackResponse>(
      "/api/feedback/assistant-message",
      {
        method: "POST",
        body: {
          mode: input.mode,
          assistantMessageId: input.assistantMessageId,
          userMessageId: input.userMessageId ?? null,
          conversationId: input.conversationId ?? null,
          caseId: input.caseId ?? null,
          reaction: input.reaction ?? null,
          comment: input.comment ?? null,
          fingerprint: input.fingerprint ?? null,
        },
      }
    );
  },

  async toggleReaction(input: {
    mode: AssistantFeedbackMode;
    assistantMessageId: string;
    nextReaction: "up" | "down";
    userMessageId?: string | null;
    conversationId?: string | null;
    caseId?: string | null;
    comment?: string | null;
    fingerprint?: string | null;
  }) {
    const existing = await this.get(input.assistantMessageId);
    const currentReaction = existing.feedback?.reaction ?? null;
    const reaction =
      currentReaction === input.nextReaction ? null : input.nextReaction;

    return this.save({
      mode: input.mode,
      assistantMessageId: input.assistantMessageId,
      userMessageId: input.userMessageId ?? null,
      conversationId: input.conversationId ?? null,
      caseId: input.caseId ?? null,
      reaction,
      comment: input.comment ?? existing.feedback?.comment ?? null,
      fingerprint: input.fingerprint ?? existing.feedback?.fingerprint ?? null,
    });
  },

  async saveComment(input: {
    mode: AssistantFeedbackMode;
    assistantMessageId: string;
    comment: string;
    userMessageId?: string | null;
    conversationId?: string | null;
    caseId?: string | null;
    fingerprint?: string | null;
  }) {
    const existing = await this.get(input.assistantMessageId);

    return this.save({
      mode: input.mode,
      assistantMessageId: input.assistantMessageId,
      userMessageId:
        input.userMessageId ?? existing.feedback?.userMessageId ?? null,
      conversationId:
        input.conversationId ?? existing.feedback?.conversationId ?? null,
      caseId: input.caseId ?? existing.feedback?.caseId ?? null,
      reaction: existing.feedback?.reaction ?? null,
      comment: input.comment,
      fingerprint: input.fingerprint ?? existing.feedback?.fingerprint ?? null,
    });
  },
};

