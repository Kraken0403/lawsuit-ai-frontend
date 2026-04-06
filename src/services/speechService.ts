import { apiRequest } from "../lib/api";

export const speechService = {
  transcribe(formData: FormData) {
    return apiRequest<{
      ok: true;
      text: string;
      model: string;
      usage?: unknown;
    }>("/api/drafting/speech/transcribe", {
      method: "POST",
      body: formData,
    });
  },
};