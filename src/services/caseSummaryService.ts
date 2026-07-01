import { API_BASE } from "../lib/apiBase";

export type DetailedSummarySections = {
  overview: string;
  facts: string;
  proceduralHistory: string;
  issues: string[];
  holding: string;
  reasoning: string;
  statutesAndArticles: string[];
  precedentsDiscussed: string[];
  finalDisposition: string;
  bench: string[];
  keyTakeaways: string[];
};

export type DetailedCaseSummary = {
  id: string;
  caseId: string;
  fileName: string | null;
  title: string | null;
  citation: string | null;
  summaryType: string;
  sourceType: string;
  sourceHash: string;
  modelName: string | null;
  status: string;
  sectionsJson: DetailedSummarySections;
  renderedMarkdown: string | null;
  createdAt: string;
  updatedAt: string;
};

type DetailedSummaryResponse = {
  ok: boolean;
  summaryType: string;
  cached: boolean;
  summary: DetailedCaseSummary;
};

export type DetailedSummaryStreamEvent =
  | {
      type: "status";
      phase: string;
    }
  | {
      type: "delta";
      text: string;
    }
  | {
      type: "done";
      cached: boolean;
      summary: DetailedCaseSummary;
    }
  | {
      type: "error";
      message: string;
    };

export const caseSummaryService = {
  async getDetailed(
    caseId: string | number,
    options?: {
      html?: string | null;
    }
  ) {
    const html = typeof options?.html === "string" ? options.html : "";

    let response: Response;

    if (html.trim()) {
      response = await fetch(
        `${API_BASE}/api/cases/${encodeURIComponent(
          String(caseId)
        )}/summary/detailed`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ html }),
        }
      );
    } else {
      response = await fetch(
        `${API_BASE}/api/cases/${encodeURIComponent(
          String(caseId)
        )}/summary/detailed`,
        {
          method: "GET",
          credentials: "include",
        }
      );
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        payload?.error || `Request failed with status ${response.status}`
      );
    }

    return payload as DetailedSummaryResponse;
  },

  async streamDetailed(
    caseId: string | number,
    options: {
      html?: string | null;
    },
    onEvent: (event: DetailedSummaryStreamEvent) => void,
    streamOptions?: { signal?: AbortSignal }
  ) {
    const response = await fetch(
      `${API_BASE}/api/cases/${encodeURIComponent(
        String(caseId)
      )}/summary/detailed/stream`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          html: typeof options?.html === "string" ? options.html : "",
        }),
        signal: streamOptions?.signal,
      }
    );

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
            onEvent(JSON.parse(line) as DetailedSummaryStreamEvent);
          } catch (error) {
            console.error("Bad detailed summary stream line:", line, error);
          }
        }

        newlineIndex = buffer.indexOf("\n");
      }
    }

    const finalLine = buffer.trim();
    if (finalLine) {
      onEvent(JSON.parse(finalLine) as DetailedSummaryStreamEvent);
    }
  },
};

