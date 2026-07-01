import { apiRequest } from "../lib/api";

export type CaseFeedbackReaction = "up" | "down" | null;

export type SuggestedCaseFeedback = {
  id: string;
  caseId: string;
  fingerprint: string | null;
  feedback: CaseFeedbackReaction;
  comment: string;
  userMessageId: string | null;
  assistantMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

type GetCaseFeedbackResponse = {
  ok: boolean;
  feedback: SuggestedCaseFeedback | null;
};

type SaveCaseFeedbackResponse = {
  ok: boolean;
  removed: boolean;
  feedback: SuggestedCaseFeedback | null;
};

export const caseFeedbackService = {
  get(caseId: string | number, assistantMessageId: string) {
    const qs = new URLSearchParams({
      assistantMessageId,
    });

    return apiRequest<GetCaseFeedbackResponse>(
      `/api/cases/${encodeURIComponent(String(caseId))}/feedback?${qs.toString()}`,
      {
        method: "GET",
      }
    );
  },

  save(input: {
    caseId: string | number;
    assistantMessageId: string;
    feedback?: CaseFeedbackReaction;
    comment?: string | null;
    userMessageId?: string | null;
    fingerprint?: string | null;
  }) {
    return apiRequest<SaveCaseFeedbackResponse>(
      `/api/cases/${encodeURIComponent(String(input.caseId))}/feedback`,
      {
        method: "POST",
        body: {
          feedback: input.feedback ?? null,
          comment: input.comment ?? null,
          userMessageId: input.userMessageId ?? null,
          assistantMessageId: input.assistantMessageId,
          fingerprint: input.fingerprint ?? null,
        },
      }
    );
  },

  async toggleReaction(input: {
    caseId: string | number;
    assistantMessageId: string;
    nextReaction: "up" | "down";
    userMessageId?: string | null;
    fingerprint?: string | null;
  }) {
    const existing = await this.get(input.caseId, input.assistantMessageId);
    const currentReaction = existing.feedback?.feedback ?? null;
    const feedback = currentReaction === input.nextReaction ? null : input.nextReaction;

    return this.save({
      caseId: input.caseId,
      assistantMessageId: input.assistantMessageId,
      userMessageId: input.userMessageId ?? existing.feedback?.userMessageId ?? null,
      comment: existing.feedback?.comment ?? null,
      fingerprint: input.fingerprint ?? existing.feedback?.fingerprint ?? null,
      feedback,
    });
  },
};
