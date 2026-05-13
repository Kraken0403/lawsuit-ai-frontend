import { apiRequest } from "../lib/api";

export type TranslateCaseResponse = {
  ok: boolean;
  caseId: string;
  provider: "google_translate_free_unofficial";
  translatedText: string;
  targetLanguage: string;
  sourceLanguage: string;
  chunks: number;
  truncated: boolean;
  originalLength: number;
  translatedLength: number;
};

export const caseUtilityService = {
  translate(
    caseId: string | number,
    payload: {
      text: string;
      targetLanguage: string;
      sourceLanguage?: string;
    }
  ) {
    return apiRequest<TranslateCaseResponse>(`/api/cases/${caseId}/translate`, {
      method: "POST",
      body: payload,
    });
  },
};