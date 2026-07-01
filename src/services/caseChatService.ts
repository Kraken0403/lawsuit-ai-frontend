import type { StreamTrace } from "../streamChat";
import { API_BASE } from "../lib/apiBase";

export type CaseChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CaseChatStreamEvent =
  | {
      type: "status";
      phase: string;
      trace?: StreamTrace | null;
    }
  | {
      type: "delta";
      text: string;
    }
  | {
      type: "done";
      caseId: string;
      title: string;
      citation: string;
      trace?: StreamTrace | null;
    }
  | {
      type: "error";
      message: string;
      trace?: StreamTrace | null;
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
    return fetch(`${API_BASE}/api/cases/${caseId}/chat`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    }).then(async (response) => {
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || `Request failed with status ${response.status}`);
      }

      return payload as CaseChatResponse;
    });
  },

  async streamAsk(
    caseId: string | number,
    messages: CaseChatMessage[],
    onEvent: (event: CaseChatStreamEvent) => void,
    options?: { signal?: AbortSignal }
  ) {
    const response = await fetch(`${API_BASE}/api/cases/${caseId}/chat/stream`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
      },
      body: JSON.stringify({ messages }),
      signal: options?.signal,
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      throw new Error(`Stream failed with status ${response.status}: ${text}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
          try {
            onEvent(JSON.parse(line) as CaseChatStreamEvent);
          } catch (error) {
            console.error("Bad case chat stream line:", line, error);
          }
        }

        newlineIndex = buffer.indexOf("\n");
      }
    }

    const finalLine = buffer.trim();
    if (finalLine) {
      onEvent(JSON.parse(finalLine) as CaseChatStreamEvent);
    }
  },
};
