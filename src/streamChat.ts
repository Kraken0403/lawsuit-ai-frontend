export type SourceItem = {
  title: string;
  citation: string;
  range?: string;
};

export type CaseDigest = {
  caseId: number;
  title: string;
  citation: string;
  summary: string;
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  caseDigests?: CaseDigest[];
};

export type StreamTrace = {
  originalQuery?: string;
  effectiveQuery?: string;
  router?: unknown;
  classifiedFallback?: unknown;
  resolvedReference?: unknown;
  filtersApplied?: Record<string, unknown>;
  notes?: string[];
};

export type StreamEvent =
  | {
      type: "status";
      phase: string;
      trace?: StreamTrace | null;
      conversationId?: string | null;
    }
  | {
      type: "meta";
      mode?: string;
      sources: SourceItem[];
      caseDigests: CaseDigest[];
      trace?: StreamTrace | null;
      conversationId?: string | null;
    }
  | { type: "delta"; text: string; conversationId?: string | null }
  | {
      type: "done";
      answerType?: string;
      confidence?: number;
      conversationId?: string | null;
    }
  | {
      type: "error";
      message: string;
      conversationId?: string | null;
    };

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

export async function streamChat(
  payload: { query: string; conversationId?: string | null },
  onEvent: (event: StreamEvent) => void,
  options?: { signal?: AbortSignal }
) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(payload),
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
          const parsed = JSON.parse(line) as StreamEvent;
          onEvent(parsed);
        } catch (error) {
          console.error("Bad stream line:", line, error);
        }
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  const finalLine = buffer.trim();
  if (finalLine) {
    try {
      const parsed = JSON.parse(finalLine) as StreamEvent;
      onEvent(parsed);
    } catch (error) {
      console.error("Bad final stream line:", finalLine, error);
    }
  }
}