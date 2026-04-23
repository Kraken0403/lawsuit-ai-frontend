import { useEffect, useMemo, useRef, useState } from "react";
import type {
  MouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import type { CaseDigest, StreamTrace } from "../streamChat";
import { buildStreamingThoughts } from "../lib/appHelpers";
import {
  caseService,
  type QdrantFullCase,
  type SqlFullCase,
} from "../services/caseService";
import {
  caseSummaryService,
  type DetailedCaseSummary,
  type DetailedSummarySections,
} from "../services/caseSummaryService";
import {
  caseChatService,
  type CaseChatMessage,
} from "../services/caseChatService";

type CaseModalTab = "case" | "summary";

type CaseModalProps = {
  open: boolean;
  caseItem: CaseDigest | null;
  onClose: () => void;
  initialTab?: CaseModalTab;
};

type ChatUiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  trace?: StreamTrace | null;
};

const detailedSummaryCache = new Map<string, DetailedCaseSummary>();

function uuid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function emptyDetailedSummarySections(): DetailedSummarySections {
  return {
    overview: "",
    facts: "",
    proceduralHistory: "",
    issues: [],
    holding: "",
    reasoning: "",
    statutesAndArticles: [],
    precedentsDiscussed: [],
    finalDisposition: "",
    bench: [],
    keyTakeaways: [],
  };
}

function hasAnyDetailedSummaryContent(
  sections: DetailedSummarySections | null | undefined
) {
  if (!sections) return false;

  return Boolean(
    sections.overview ||
      sections.facts ||
      sections.proceduralHistory ||
      sections.holding ||
      sections.reasoning ||
      sections.finalDisposition ||
      sections.issues?.length ||
      sections.statutesAndArticles?.length ||
      sections.precedentsDiscussed?.length ||
      sections.bench?.length ||
      sections.keyTakeaways?.length
  );
}

function cleanMarkdownInline(text: string) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

function cleanMarkdownBlock(text: string) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownListToArray(text: string) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "").trim())
    .map(cleanMarkdownInline)
    .filter(Boolean);
}

function parseDetailedSummaryMarkdown(markdown: string) {
  const sections = emptyDetailedSummarySections();

  const headingMap: Record<string, keyof DetailedSummarySections> = {
    Overview: "overview",
    Facts: "facts",
    "Procedural History": "proceduralHistory",
    Issues: "issues",
    Holding: "holding",
    Reasoning: "reasoning",
    "Statutes and Articles": "statutesAndArticles",
    "Precedents Discussed": "precedentsDiscussed",
    "Final Disposition": "finalDisposition",
    Bench: "bench",
    "Key Takeaways": "keyTakeaways",
  };

  const regex =
    /^##\s+(Overview|Facts|Procedural History|Issues|Holding|Reasoning|Statutes and Articles|Precedents Discussed|Final Disposition|Bench|Key Takeaways)\s*$/gim;

  const matches = [...markdown.matchAll(regex)];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const heading = match[1];
    const key = headingMap[heading];

    if (!key || typeof match.index !== "number") continue;

    const start = match.index + match[0].length;
    const end =
      i + 1 < matches.length && typeof matches[i + 1].index === "number"
        ? matches[i + 1].index
        : markdown.length;

    const rawBlock = markdown.slice(start, end).trim();

    if (
      key === "issues" ||
      key === "statutesAndArticles" ||
      key === "precedentsDiscussed" ||
      key === "bench" ||
      key === "keyTakeaways"
    ) {
      (sections[key] as string[]) = markdownListToArray(rawBlock);
    } else {
      (sections[key] as string) = cleanMarkdownBlock(rawBlock);
    }
  }

  return sections;
}

function buildWordDocumentHtml(
  docTitle: string,
  htmlBody: string,
  plainTextFallback: string
) {
  const body = htmlBody?.trim()
    ? `<div class="case-html">${htmlBody}</div>`
    : `<pre class="plain-text">${escapeHtml(plainTextFallback || "")}</pre>`;

  return `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: "Times New Roman", serif;
      color: #111827;
      line-height: 1.55;
      margin: 24px;
      font-size: 12pt;
    }
    .case-html {
      max-width: 100%;
    }
    .plain-text {
      white-space: pre-wrap;
      font-family: "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.55;
      margin: 0;
    }
    p { margin: 0 0 10px 0; }
    h1, h2, h3, h4, h5, h6 { margin: 14px 0 8px 0; }
    table { border-collapse: collapse; width: 100%; }
    td, th { vertical-align: top; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`.trim();
}

function escapeHtml(text: string) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function DocDownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function PdfDownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13h1a2 2 0 0 1 0 4H9v-4z" />
      <path d="M14 13h2" />
      <path d="M14 17h2" />
      <path d="M19 13v4" />
    </svg>
  );
}

function Loader({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
      {text}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
      {message}
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 ">
      <div className="border-b border-slate-200 px-5 py-4 bg-[#f6f6f6]">
        <div className="text-[12px] font-semibold uppercase text-slate-800">
          {title}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items?: string[] }) {
  if (!items?.length) {
    return <div className="text-sm text-slate-500">Not available.</div>;
  }

  return (
    <ul className="space-y-2 text-sm leading-7 text-slate-700">
      {items.map((item, index) => (
        <li key={`${item}_${index}`} className="flex gap-3">
          <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#114C8D]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition ${
        active
          ? "bg-[#114C8D] text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      }`}
    >
      {children}
    </button>
  );
}

function sanitizeCaseHtml(rawHtml: string) {
  if (!rawHtml || typeof window === "undefined") return rawHtml;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");

  doc.querySelectorAll("script, iframe, object, embed").forEach((node) => {
    node.remove();
  });

  doc.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }

      if (
        (name === "href" || name === "src") &&
        value.trim().toLowerCase().startsWith("javascript:")
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  doc.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (
      href.startsWith("ContentView.aspx") ||
      href.startsWith("#") ||
      href.startsWith("javascript:")
    ) {
      a.removeAttribute("href");
    }
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });

  doc.querySelectorAll("hr, br").forEach((node) => node.remove());

  return doc.body.innerHTML;
}

function renderAssistantContent(content: string) {
  const text = String(content || "").replace(/\r/g, "").trim();

  if (!text) {
    return null;
  }

  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const rawLine = lines[index] || "";
    const line = rawLine.trim();

    if (!line) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      if (level === 1) {
        blocks.push(
          <h1
            key={`block_${key++}`}
            className="mb-2 text-[15px] font-semibold text-slate-900"
          >
            {headingText}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2
            key={`block_${key++}`}
            className="mb-2 mt-3 text-[14px] font-semibold text-slate-900"
          >
            {headingText}
          </h2>
        );
      } else {
        blocks.push(
          <h3
            key={`block_${key++}`}
            className="mb-2 mt-3 text-[13px] font-semibold text-slate-900"
          >
            {headingText}
          </h3>
        );
      }

      index += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const candidate = (lines[index] || "").trim();
        const match = candidate.match(/^[-*•]\s+(.*)$/);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }

      blocks.push(
        <ul
          key={`block_${key++}`}
          className="mb-2 ml-5 list-disc space-y-1 text-[14px] leading-6 text-slate-700"
        >
          {items.map((item, itemIndex) => (
            <li key={`bullet_${itemIndex}`}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const candidate = (lines[index] || "").trim();
        const match = candidate.match(/^\d+\.\s+(.*)$/);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }

      blocks.push(
        <ol
          key={`block_${key++}`}
          className="mb-2 ml-5 list-decimal space-y-1 text-[14px] leading-6 text-slate-700"
        >
          {items.map((item, itemIndex) => (
            <li key={`numbered_${itemIndex}`}>{item}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;

    while (index < lines.length) {
      const nextLine = (lines[index] || "").trim();

      if (
        !nextLine ||
        /^(#{1,3})\s+/.test(nextLine) ||
        /^[-*•]\s+/.test(nextLine) ||
        /^\d+\.\s+/.test(nextLine)
      ) {
        break;
      }

      paragraphLines.push(nextLine);
      index += 1;
    }

    blocks.push(
      <p
        key={`block_${key++}`}
        className="mb-2 whitespace-pre-wrap text-[14px] leading-6 text-slate-700"
      >
        {paragraphLines.join(" ")}
      </p>
    );
  }

  return blocks.length ? (
    <div>{blocks}</div>
  ) : (
    <p className="whitespace-pre-wrap text-[14px] leading-6 text-slate-700">
      {text}
    </p>
  );
}

export default function CaseModal({
  open,
  caseItem,
  onClose,
  initialTab = "case",
}: CaseModalProps) {
  const [activeTab, setActiveTab] = useState<CaseModalTab>(initialTab);

  const [qdrantLoading, setQdrantLoading] = useState(false);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [caseError, setCaseError] = useState("");
  const [summaryError, setSummaryError] = useState("");

  const [sqlCase, setSqlCase] = useState<SqlFullCase | null>(null);
  const [qdrantCase, setQdrantCase] = useState<QdrantFullCase | null>(null);
  const [detailedSummary, setDetailedSummary] =
    useState<DetailedCaseSummary | null>(null);
  const [summaryPreviewSections, setSummaryPreviewSections] =
    useState<DetailedSummarySections | null>(null);
  const [summaryPhase, setSummaryPhase] = useState("");
  // const [summaryStreamMarkdown, setSummaryStreamMarkdown] = useState("");

  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatUiMessage[]>([]);
  const [chatPhase, setChatPhase] = useState("");
  const [chatTrace, setChatTrace] = useState<StreamTrace | null>(null);
  const [chatThoughtIndex, setChatThoughtIndex] = useState(0);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const chatTraceRef = useRef<StreamTrace | null>(null);

  const summaryAbortRef = useRef<AbortController | null>(null);
  const summaryMarkdownRef = useRef("");

  useEffect(() => {
    chatTraceRef.current = chatTrace;
  }, [chatTrace]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    return () => {
      if (chatAbortRef.current) {
        chatAbortRef.current.abort();
        chatAbortRef.current = null;
      }
      if (summaryAbortRef.current) {
        summaryAbortRef.current.abort();
        summaryAbortRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open || !caseItem?.caseId) return;

    let cancelled = false;

    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
      chatAbortRef.current = null;
    }

    if (summaryAbortRef.current) {
      summaryAbortRef.current.abort();
      summaryAbortRef.current = null;
    }

    setQdrantLoading(true);
    setSqlLoading(true);
    setSummaryLoading(false);
    setCaseError("");
    setSummaryError("");
    setSummaryPhase("");
    // setSummaryStreamMarkdown("");
    summaryMarkdownRef.current = "";
    setSummaryPreviewSections(null);
    setSqlCase(null);
    setQdrantCase(null);

    const cachedSummary =
      detailedSummaryCache.get(String(caseItem.caseId)) || null;
    setDetailedSummary(cachedSummary);

    setChatOpen(false);
    setChatInput("");
    setChatLoading(false);
    setChatPhase("");
    setChatTrace(null);
    setChatThoughtIndex(0);
    setChatMessages([
      {
        id: "intro",
        role: "assistant",
        content:
          "Ask anything about this case. I will answer only from this case record.",
        streaming: false,
        trace: null,
      },
    ]);

    caseService
      .getFromQdrant(caseItem.caseId)
      .then((response) => {
        if (!cancelled) {
          setQdrantCase(response.case);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCaseError(
            error instanceof Error
              ? error.message
              : "Failed to load case metadata."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQdrantLoading(false);
        }
      });

    caseService
      .getFromSql(caseItem.caseId)
      .then((response) => {
        if (!cancelled) {
          setSqlCase(response.case);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[sql case fetch failed]", error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSqlLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (chatAbortRef.current) {
        chatAbortRef.current.abort();
        chatAbortRef.current = null;
      }
      if (summaryAbortRef.current) {
        summaryAbortRef.current.abort();
        summaryAbortRef.current = null;
      }
    };
  }, [open, caseItem, initialTab]);

  const loadDetailedSummary = async (
    caseId: string | number,
    options?: { force?: boolean }
  ) => {
    const key = String(caseId);
    const force = options?.force === true;

    if (!force && detailedSummaryCache.has(key)) {
      setDetailedSummary(detailedSummaryCache.get(key) || null);
      setSummaryPreviewSections(
        detailedSummaryCache.get(key)?.sectionsJson || null
      );
      setSummaryError("");
      setSummaryLoading(false);
      setSummaryPhase("");
      // setSummaryStreamMarkdown("");
      summaryMarkdownRef.current = "";
      return;
    }

    if (summaryAbortRef.current) {
      summaryAbortRef.current.abort();
    }

    const controller = new AbortController();
    summaryAbortRef.current = controller;

    setSummaryLoading(true);
    setSummaryError("");
    setSummaryPhase("Preparing detailed summary");
    // setSummaryStreamMarkdown("");
    summaryMarkdownRef.current = "";
    setSummaryPreviewSections(emptyDetailedSummarySections());
    setDetailedSummary(null);

    try {
      await caseSummaryService.streamDetailed(
        caseId,
        {
          html: sqlCase?.jtext || "",
        },
        (event) => {
          if (event.type === "status") {
            setSummaryPhase(event.phase || "Generating detailed summary");
            return;
          }

          if (event.type === "delta") {
            summaryMarkdownRef.current += event.text;
            // setSummaryStreamMarkdown(summaryMarkdownRef.current);
            setSummaryPreviewSections(
              parseDetailedSummaryMarkdown(summaryMarkdownRef.current)
            );
            return;
          }

          if (event.type === "done") {
            detailedSummaryCache.set(key, event.summary);
            setDetailedSummary(event.summary);
            setSummaryPreviewSections(event.summary.sectionsJson);
            setSummaryPhase("");
            return;
          }

          if (event.type === "error") {
            setSummaryError(
              event.message || "Failed to load detailed summary."
            );
            setSummaryPhase("");
          }
        },
        { signal: controller.signal }
      );
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setSummaryError(
        error instanceof Error
          ? error.message
          : "Failed to load detailed summary."
      );
      setSummaryPhase("");
    } finally {
      if (summaryAbortRef.current === controller) {
        summaryAbortRef.current = null;
      }
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (!open || activeTab !== "summary" || !caseItem?.caseId) return;
    if (detailedSummary || summaryLoading) return;

    void loadDetailedSummary(caseItem.caseId);
  }, [open, activeTab, caseItem?.caseId, detailedSummary, summaryLoading]);

  useEffect(() => {
    if (!chatOpen) return;

    requestAnimationFrame(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    });
  }, [chatMessages, chatOpen, chatPhase, chatThoughtIndex]);

  const sanitizedHtml = useMemo(
    () => sanitizeCaseHtml(sqlCase?.jtext || ""),
    [sqlCase?.jtext]
  );

  const title = qdrantCase?.title || caseItem?.title || "";
  const citation = qdrantCase?.citation || caseItem?.citation || "";
  const court = qdrantCase?.court ?? null;
  const dateOfDecision = qdrantCase?.dateOfDecision ?? null;
  const sections =
    detailedSummary?.sectionsJson ||
    (hasAnyDetailedSummaryContent(summaryPreviewSections)
      ? summaryPreviewSections
      : null);

  const chatThoughts = useMemo(
    () => buildStreamingThoughts(chatPhase, chatTrace),
    [chatPhase, chatTrace]
  );

  const activeChatThought =
    chatThoughts[chatThoughtIndex] || chatPhase || "Thinking";

  useEffect(() => {
    if (!chatLoading) {
      setChatThoughtIndex(0);
      return;
    }

    setChatThoughtIndex(0);

    if (chatThoughts.length <= 1) return;

    const interval = window.setInterval(() => {
      setChatThoughtIndex((prev) => (prev + 1) % chatThoughts.length);
    }, 1700);

    return () => window.clearInterval(interval);
  }, [chatLoading, chatThoughts]);

  const handleDownload = (format: "doc" | "pdf") => {
    const content = sqlCase?.jtext || qdrantCase?.fullText || "";
    if (!content) return;

    const safeTitle = (title || "case").replace(/[^a-z0-9\-_ ]/gi, "_");

    if (format === "pdf") {
      const win = window.open("", "_blank");
      if (!win) return;

      win.document.write(
        `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>` +
          `<style>body{font-family:Inter,system-ui,sans-serif;color:#0f172a;padding:24px}.case-html{max-width:900px;margin:0 auto}</style></head>` +
          `<body><div class="case-html">${content}</div></body></html>`
      );
      win.document.close();

      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          // ignore
        }
      }, 300);

      return;
    }

    const docHtml = buildWordDocumentHtml(
      safeTitle,
      sanitizedHtml,
      qdrantCase?.fullText || ""
    );

    const blob = new Blob(["\ufeff", docHtml], {
      type: "application/msword",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!open || !caseItem) return null;

  const stopPropagation = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading || !caseItem?.caseId) return;

    const userId = uuid();
    const assistantId = uuid();

    const nextMessages: ChatUiMessage[] = [
      ...chatMessages,
      { id: userId, role: "user", content: text, streaming: false, trace: null },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        trace: null,
      },
    ];

    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    setChatPhase("Thinking");
    setChatTrace(null);
    setChatThoughtIndex(0);

    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }

    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const payloadMessages = nextMessages
        .filter((message) => message.id !== "intro")
        .map<CaseChatMessage>((message) => ({
          role: message.role,
          content: message.content,
        }));

      await caseChatService.streamAsk(
        caseItem.caseId,
        payloadMessages,
        (event) => {
          if (event.type === "status") {
            setChatPhase(event.phase || "Thinking");
            setChatTrace(event.trace || null);

            setChatMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      trace: event.trace || message.trace || null,
                    }
                  : message
              )
            );
            return;
          }

          if (event.type === "delta") {
            setChatMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: `${message.content}${event.text}`,
                      streaming: true,
                      trace: chatTraceRef.current,
                    }
                  : message
              )
            );
            return;
          }

          if (event.type === "done") {
            setChatMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      streaming: false,
                      trace: event.trace || chatTraceRef.current,
                    }
                  : message
              )
            );
            setChatPhase("");
            setChatTrace(event.trace || chatTraceRef.current || null);
            return;
          }

          if (event.type === "error") {
            setChatMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content:
                        event.message || "Failed to chat about this case.",
                      streaming: false,
                      trace: event.trace || chatTraceRef.current,
                    }
                  : message
              )
            );
            setChatPhase("");
            setChatTrace(event.trace || chatTraceRef.current || null);
          }
        },
        { signal: controller.signal }
      );
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setChatMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  error instanceof Error
                    ? error.message
                    : "Failed to chat about this case.",
                streaming: false,
                trace: chatTraceRef.current,
              }
            : message
        )
      );

      setChatPhase("");
      setChatTrace(chatTraceRef.current || null);
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
      }
      setChatLoading(false);
    }
  };

  const onChatKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendChat();
    }
  };

  const renderCaseTitle = () => {
    const t = title || "";
    const sepRegex = /\s+(?:v\/s|v\.s\.|v\.s|vs\.|vs|v\.)\s+/i;
    const match = t.match(sepRegex);

    if (match && typeof match.index === "number") {
      const left = t.slice(0, match.index).trim();
      const right = t.slice(match.index + match[0].length).trim();

      return (
        <div className="mt-2 text-center">
          <div className="text-[15px] font-extrabold uppercase tracking-wide text-[#114C8D]">
            {left}
          </div>
          <div className="my-1 text-sm font-medium italic text-slate-500">
            Versus
          </div>
          <div className="text-[15px] font-extrabold uppercase tracking-wide text-[#114C8D]">
            {right}
          </div>
        </div>
      );
    }

    return (
      <h2 className="mt-2 text-center text-[15px] font-extrabold uppercase tracking-wide text-[#114C8D]">
        {t}
      </h2>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] max-h-[92vh] w-[92%] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.2)]"
        onClick={stopPropagation}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-3">
          <div className="flex min-w-[200px] items-center">
            <img src="/logo.png" alt="Lawsuit AI" className="h-8 object-contain" />
          </div>

          <div className="flex items-center gap-2">
            <TabButton
              active={activeTab === "case"}
              onClick={() => setActiveTab("case")}
            >
              Complete Case
            </TabButton>
            <TabButton
              active={activeTab === "summary"}
              onClick={() => setActiveTab("summary")}
            >
              Detailed Summary
            </TabButton>
          </div>

          <div className="flex min-w-[200px] items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleDownload("doc")}
              title="Download as DOC"
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <DocDownloadIcon />
              <span>DOC</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload("pdf")}
              title="Download as PDF"
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <PdfDownloadIcon />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Close modal"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-6 py-5 text-center">
          {court ? (
            <div className="text-[12px] font-bold uppercase tracking-widest text-[#C0392B]">
              {court}
            </div>
          ) : qdrantLoading ? (
            <div className="mx-auto h-4 w-48 animate-pulse rounded bg-slate-100" />
          ) : null}

          {renderCaseTitle()}

          <div className="mt-3 text-sm text-slate-600">
            {dateOfDecision && (
              <div>
                <span className="font-semibold text-slate-800">
                  Date of Decision:
                </span>
                <span className="ml-2">{dateOfDecision}</span>
              </div>
            )}

            {citation && (
              <div className="mt-1">
                <span className="font-semibold text-slate-800">Citation:</span>
                <span className="ml-2">{citation}</span>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {activeTab === "case" && (
            <div className="space-y-6">
              {caseError ? <ErrorBox message={caseError} /> : null}

              {sqlLoading ? (
                <Loader text="Loading complete judgment…" />
              ) : sqlCase?.jtext ? (
                <div className="case-html prose prose-slate max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                </div>
              ) : qdrantCase?.fullText ? (
                <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {qdrantCase.fullText}
                </div>
              ) : (
                !qdrantLoading &&
                !sqlLoading && (
                  <ErrorBox message="No complete case body found." />
                )
              )}
            </div>
          )}

          {activeTab === "summary" && (
            <div className="space-y-6">
              {summaryError ? (
                <div className="space-y-3">
                  <ErrorBox message={summaryError} />
                  <button
                    type="button"
                    onClick={() =>
                      void loadDetailedSummary(caseItem.caseId, { force: true })
                    }
                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    Retry
                  </button>
                </div>
              ) : hasAnyDetailedSummaryContent(sections) ? (
                <>
                  {summaryLoading && (
                    <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <span>{summaryPhase || "Generating detailed summary"}</span>
                      <span className="inline-block animate-pulse text-[#114C8D]">
                        |
                      </span>
                    </div>
                  )}

                  <SectionCard title="Overview">
                    <div className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                      {sections?.overview || "Not available."}
                    </div>
                  </SectionCard>

                  <SectionCard title="Facts">
                    <div className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                      {sections?.facts || "Not available."}
                    </div>
                  </SectionCard>

                  <SectionCard title="Procedural history">
                    <div className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                      {sections?.proceduralHistory || "Not available."}
                    </div>
                  </SectionCard>

                  <SectionCard title="Issues">
                    <BulletList items={sections?.issues} />
                  </SectionCard>

                  <SectionCard title="Holding">
                    <div className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                      {sections?.holding || "Not available."}
                    </div>
                  </SectionCard>

                  <SectionCard title="Reasoning">
                    <div className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                      {sections?.reasoning || "Not available."}
                    </div>
                  </SectionCard>

                  <SectionCard title="Statutes and articles">
                    <BulletList items={sections?.statutesAndArticles} />
                  </SectionCard>

                  <SectionCard title="Precedents discussed">
                    <BulletList items={sections?.precedentsDiscussed} />
                  </SectionCard>

                  <SectionCard title="Final disposition">
                    <div className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                      {sections?.finalDisposition || "Not available."}
                    </div>
                  </SectionCard>

                  <SectionCard title="Bench">
                    <BulletList items={sections?.bench} />
                  </SectionCard>

                  <SectionCard title="Key takeaways">
                    <BulletList items={sections?.keyTakeaways} />
                  </SectionCard>
                </>
              ) : summaryLoading ? (
                <Loader
                  text={summaryPhase || "Generating or loading detailed summary…"}
                />
              ) : (
                <Loader text="Open this tab to load the detailed summary." />
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setChatOpen((prev) => !prev)}
          className="absolute bottom-6 right-6 inline-flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-[#114C8D] text-white shadow-[0_18px_50px_rgba(17,76,141,0.35)] transition hover:bg-[#0B3A6E]"
          aria-label="Open case-only chat"
        >
          <ChatIcon />
        </button>

        {chatOpen && (
          <div className="absolute bottom-24 right-6 flex h-[460px] w-[360px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.2)]">
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Case-only chat
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Ask only about this case
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div
              ref={chatScrollRef}
              className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
            >
              <div className="space-y-4">
                {chatMessages.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[88%] ${isUser ? "items-end" : "items-start"} flex flex-col`}
                      >
                        <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {isUser ? "You" : "Assistant"}
                        </div>

                        <div
                          className={`rounded-2xl px-4 py-3 text-[14px] leading-6 ${
                            isUser
                              ? "bg-[#114C8D] text-white"
                              : "border-[0px] bg-white text-slate-700"
                          }`}
                        >
                          {isUser ? (
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          ) : (
                            <div>
                              {renderAssistantContent(message.content)}
                              {message.streaming && (
                                <div className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                                  <span>{activeChatThought}</span>
                                  <span className="inline-block animate-pulse text-[#114C8D]">
                                    |
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-200 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={onChatKeyDown}
                  rows={1}
                  placeholder="Ask anything about this case..."
                  className="max-h-[120px] min-h-[48px] flex-1 resize-none rounded-full border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() => void handleSendChat()}
                  disabled={!chatInput.trim() || chatLoading}
                  className="inline-flex h-[48px] w-[48px] cursor-pointer items-center justify-center rounded-2xl bg-[#114C8D] text-white transition hover:bg-[#0B3A6E] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  aria-label="Send message"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 2 11 13" />
                    <path d="M22 2 15 22l-4-9-9-4Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

