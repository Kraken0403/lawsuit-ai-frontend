import express from "express";
import { orchestrateSearch } from "../../orchestrator/searchOrchestrator.js";
import { composeAnswer } from "../../answer/composeAnswer.js";

export const chatStreamRouter = express.Router();

type SourceItem = {
  title: string;
  citation: string;
  range?: string;
};

type CaseDigest = {
  caseId?: number;
  title: string;
  citation: string;
  summary: string;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  caseDigests?: CaseDigest[];
};

function writeEvent(res: express.Response, data: unknown) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`${JSON.stringify(data)}\n`);
  if (typeof (res as any).flush === "function") {
    (res as any).flush();
  }
}

function citationRange(c: {
  paragraphStart?: number | null;
  paragraphEnd?: number | null;
}) {
  if (c.paragraphStart == null || c.paragraphEnd == null) return "";
  if (c.paragraphStart === c.paragraphEnd) return `para ${c.paragraphStart}`;
  return `paras ${c.paragraphStart}-${c.paragraphEnd}`;
}

function chunkText(text: string, size = 6) {
  const parts: string[] = [];
  let i = 0;

  while (i < text.length) {
    parts.push(text.slice(i, i + size));
    i += size;
  }

  return parts;
}

function compact(value: unknown) {
  return String(value ?? "").trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildTrace(searchResult: any, originalQuery: string) {
  const routerCandidate =
    searchResult?.trace?.router ||
    searchResult?.classified ||
    searchResult?.classification ||
    searchResult?.router ||
    searchResult?.query ||
    {};

  const notes: string[] = [];

  if (searchResult?.mode) {
    notes.push(`Mode: ${searchResult.mode}`);
  }

  if (Array.isArray(searchResult?.trace?.notes)) {
    for (const note of searchResult.trace.notes.slice(0, 4)) {
      if (typeof note === "string" && note.trim()) {
        notes.push(note.trim());
      }
    }
  }

  return {
    originalQuery,
    effectiveQuery:
      compact(searchResult?.effectiveQuery) ||
      compact(searchResult?.normalizedQuery) ||
      compact(searchResult?.trace?.router?.resolvedQuery) ||
      originalQuery,
    router: routerCandidate,
    classifiedFallback: searchResult?.trace?.classifiedFallback || undefined,
    resolvedReference:
      searchResult?.trace?.resolvedReference ||
      searchResult?.resolvedReference ||
      undefined,
    filtersApplied:
      searchResult?.trace?.filtersApplied ||
      searchResult?.filtersApplied ||
      undefined,
    notes: [...new Set(notes)].slice(0, 6),
  };
}

chatStreamRouter.post("/stream", async (req, res) => {
  let clientClosed = false;

  req.on("close", () => {
    clientClosed = true;
  });

  try {
    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];

    const messages: ChatTurn[] = rawMessages
      .map((m: any) => ({
        role: m?.role === "assistant" ? "assistant" : "user",
        content: compact(m?.content).slice(0, 1000),
        caseDigests: Array.isArray(m?.caseDigests)
          ? m.caseDigests
              .slice(0, 8)
              .map((d: any) => ({
                caseId: d?.caseId,
                title: compact(d?.title),
                citation: compact(d?.citation),
                summary: compact(d?.summary),
              }))
              .filter((d: CaseDigest) => d.title || d.citation || d.summary)
          : [],
      }))
      .filter((m) => m.content.length > 0);

    const queryFromMessages =
      [...messages].reverse().find((m) => m.role === "user")?.content || "";

    const fallbackQuery = compact(req.body?.query).slice(0, 1000);
    const query = (queryFromMessages || fallbackQuery).slice(0, 1000);

    if (!query) {
      res.status(400).json({
        error: "Query is required.",
      });
      return;
    }

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Content-Encoding", "identity");
    res.flushHeaders?.();
    res.socket?.setNoDelay?.(true);

    writeEvent(res, { type: "status", phase: "Understanding query" });

    const searchResult = await orchestrateSearch({
      query,
      messages,
    });

    if (clientClosed) return;

    const trace = buildTrace(searchResult, query);

    writeEvent(res, {
      type: "status",
      phase: "Searching authorities",
      trace,
    });

    writeEvent(res, {
      type: "meta",
      mode: searchResult?.mode,
      sources: [],
      caseDigests: [],
      trace,
    });

    writeEvent(res, { type: "status", phase: "Drafting answer", trace });

    const answer = await composeAnswer({
      ...searchResult,
      messages,
    });

    if (clientClosed) return;

    const sources: SourceItem[] = (answer?.citations || [])
      .slice(0, 5)
      .map((c: any) => ({
        title: c.title,
        citation: c.citation,
        range: citationRange(c),
      }));

    const caseDigests = (answer?.caseDigests || [])
      .slice(0, 5)
      .map((d: any) => ({
        caseId: d.caseId,
        title: d.title,
        citation: d.citation,
        summary: d.summary,
      }));

    writeEvent(res, {
      type: "meta",
      mode: searchResult?.mode,
      sources,
      caseDigests,
      trace,
    });

    const answerText = String(answer?.summary || "").trim();

    if (answerText) {
      writeEvent(res, { type: "status", phase: "Streaming answer", trace });

      const chunks = chunkText(answerText, 6);

      for (const part of chunks) {
        if (clientClosed) return;
        writeEvent(res, { type: "delta", text: part });
        await sleep(20);
      }
    }

    writeEvent(res, {
      type: "done",
      answerType: answer?.answerType,
      confidence: answer?.confidence,
    });

    res.end();
  } catch (error: any) {
    console.error("[chatStream error]", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: error?.message || "Unexpected stream failure.",
      });
      return;
    }

    if (!clientClosed) {
      writeEvent(res, {
        type: "error",
        message: error?.message || "Unexpected stream failure.",
      });
      res.end();
    }
  }
});