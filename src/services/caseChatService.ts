import { apiRequest } from "../lib/api";

export type CaseChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type CaseChatResponse = {
  ok: boolean;
  caseId: string;
  title: string;
  citation: string;
  answer: string;
};

export const caseChatService = {
  ask(caseId: string | number, messages: CaseChatMessage[]) {
    return apiRequest<CaseChatResponse>(`/api/cases/${caseId}/chat`, {
      method: "POST",
      body: { messages },
    });
  },
};