import { useEffect, useMemo, useRef, useState } from "react";
import type {
  MouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import type { CaseDigest } from "../streamChat";
import {
  caseService,
  type QdrantFullCase,
  type SqlFullCase,
} from "../services/caseService";
import {
  caseSummaryService,
  type DetailedCaseSummary,
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
};

function uuid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function DocDownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function HtmlDownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function PdfDownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
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

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-[11px] font-semibold uppercase text-slate-500">{title}</div>
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
      className={`cursor-pointer px-5 py-2 text-sm font-medium transition rounded-full ${active
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
  doc.querySelectorAll("script, iframe, object, embed").forEach((node) => node.remove());
  doc.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      if (
        (name === "href" || name === "src") &&
        value.trim().toLowerCase().startsWith("javascript:")
      )
        el.removeAttribute(attr.name);
    });
  });
  doc.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (
      href.startsWith("ContentView.aspx") ||
      href.startsWith("#") ||
      href.startsWith("javascript:")
    )
      a.removeAttribute("href");
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
  return doc.body.innerHTML;
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
  const [detailedSummary, setDetailedSummary] = useState<DetailedCaseSummary | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatUiMessage[]>([]);

  const chatScrollRef = useRef<HTMLDivElement>(null);

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
    if (!open || !caseItem?.caseId) return;
    let cancelled = false;

    setQdrantLoading(true);
    setSqlLoading(true);
    setSummaryLoading(true);
    setCaseError("");
    setSummaryError("");
    setSqlCase(null);
    setQdrantCase(null);
    setDetailedSummary(null);
    setChatOpen(false);
    setChatInput("");
    setChatLoading(false);
    setChatMessages([
      {
        id: "intro",
        role: "assistant",
        content:
          "Ask anything about this case. I will answer only from this case and its stored summary.",
      },
    ]);

    caseService
      .getFromQdrant(caseItem.caseId)
      .then((response) => {
        if (!cancelled) setQdrantCase(response.case);
      })
      .catch((error) => {
        if (!cancelled)
          setCaseError(
            error instanceof Error ? error.message : "Failed to load case metadata."
          );
      })
      .finally(() => {
        if (!cancelled) setQdrantLoading(false);
      });

    caseService
      .getFromSql(caseItem.caseId)
      .then((response) => {
        if (!cancelled) setSqlCase(response.case);
      })
      .catch((error) => {
        if (!cancelled) console.error("[sql case fetch failed]", error);
      })
      .finally(() => {
        if (!cancelled) setSqlLoading(false);
      });

    caseSummaryService
      .getDetailed(caseItem.caseId)
      .then((response) => {
        if (!cancelled) setDetailedSummary(response.summary);
      })
      .catch((error) => {
        if (!cancelled)
          setSummaryError(
            error instanceof Error ? error.message : "Failed to load detailed summary."
          );
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, caseItem, initialTab]);

  useEffect(() => {
    if (!chatOpen) return;
    requestAnimationFrame(() => {
      if (chatScrollRef.current)
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    });
  }, [chatMessages, chatOpen]);

  const sanitizedHtml = useMemo(
    () => sanitizeCaseHtml(sqlCase?.jtext || ""),
    [sqlCase?.jtext]
  );

  const handleDownload = (format: "doc" | "html" | "pdf") => {
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
          /* ignore */
        }
      }, 300);
      return;
    }

    const blob = new Blob([content], {
      type: format === "html" ? "text/html" : "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}.${format === "html" ? "html" : "doc"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!open || !caseItem) return null;

  const stopPropagation = (event: MouseEvent<HTMLDivElement>) =>
    event.stopPropagation();

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading || !caseItem?.caseId) return;

    const nextMessages: ChatUiMessage[] = [
      ...chatMessages,
      { id: uuid(), role: "user", content: text },
    ];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const payloadMessages = nextMessages
        .filter((m) => m.id !== "intro")
        .map<CaseChatMessage>((m) => ({ role: m.role, content: m.content }));
      const response = await caseChatService.ask(caseItem.caseId, payloadMessages);
      setChatMessages((prev) => [
        ...prev,
        { id: uuid(), role: "assistant", content: response.answer },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Failed to chat about this case.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const onChatKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendChat();
    }
  };

  // Derived display values — qdrant data when loaded, caseItem digest as fallback
  const title = qdrantCase?.title || caseItem.title;
  const citation = qdrantCase?.citation || caseItem.citation;
  const court = qdrantCase?.court ?? null;
  const dateOfDecision = qdrantCase?.dateOfDecision ?? null;
  const sections = detailedSummary?.sectionsJson;

  const renderCaseTitle = () => {
    const t = title || "";
    const sepRegex = /\s+(?:v\/s|v\.s\.|v\.s|vs\.|vs|v\.)\s+/i;
    const m = t.match(sepRegex);
    if (m && typeof m.index === "number") {
      const left = t.slice(0, m.index).trim();
      const right = t.slice(m.index + m[0].length).trim();
      return (
        <div className="mt-2 text-center">
          <div className="text-[15px] font-extrabold leading-snug text-[#114C8D] uppercase tracking-wide">
            {left}
          </div>
          <div className="my-1 text-sm italic font-medium text-slate-500">Versus</div>
          <div className="text-[15px] font-extrabold leading-snug text-[#114C8D] uppercase tracking-wide">
            {right}
          </div>
        </div>
      );
    }
    return (
      <h2 className="mt-2 text-[15px] font-extrabold leading-snug text-[#114C8D] uppercase tracking-wide text-center">
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
        className="relative flex max-h-[92vh] h-[92vh] w-[92%] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.2)]"
        onClick={stopPropagation}
      >
        {/* ── TOP BAR ── */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-3">
          {/* Left: logo to keep tabs centered */}
          <div className="min-w-[200px] flex items-center">
            <img
              src="/LawsuitAI%20Logo.png"
              alt="Lawsuit AI"
              className="h-8 object-contain"
            />
          </div>

          {/* Center: tabs */}
          <div className="flex items-center gap-2">
            <TabButton active={activeTab === "case"} onClick={() => setActiveTab("case")}>
              Complete Case
            </TabButton>
            <TabButton active={activeTab === "summary"} onClick={() => setActiveTab("summary")}>
              Detailed Summary
            </TabButton>
          </div>

          {/* Right: download buttons + close */}
          <div className="flex items-center gap-2 min-w-[200px] justify-end">
            <button
              type="button"
              onClick={() => handleDownload("doc")}
              title="Download as DOC"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <DocDownloadIcon />
              <span>DOC</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload("html")}
              title="Download as HTML"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <HtmlDownloadIcon />
              <span>HTML</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload("pdf")}
              title="Download as PDF"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <PdfDownloadIcon />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Close modal"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── CASE HEADER ── */}
        <div className="border-b border-slate-200 px-6 py-5 text-center">
          {/* Court name — renders as soon as qdrantCase arrives */}
          {court ? (
            <div className="text-[12px] font-bold uppercase tracking-widest text-[#C0392B]">
              {court}
            </div>
          ) : qdrantLoading ? (
            <div className="mx-auto h-4 w-48 animate-pulse rounded bg-slate-100" />
          ) : null}

          {/* Party A / Versus / Party B */}
          {renderCaseTitle()}

          {/* Date of Decision + Citation */}
          <div className="mt-3 text-sm text-slate-600">
            {dateOfDecision && (
              <div>
                <span className="font-semibold text-slate-800">Date of Decision:</span>
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

        {/* ── SCROLLABLE BODY ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">

          {/* COMPLETE CASE TAB */}
          {activeTab === "case" && (
            <div className="space-y-6">
              {caseError ? <ErrorBox message={caseError} /> : null}

              {sqlLoading ? (
                <Loader text="Loading complete judgment…" />
              ) : sqlCase?.jtext ? (
                /*
                 * .case-html hides .highcourt .judgtitle .judgdate .citations via index.css
                 * so the header shown in the modal above is never duplicated.
                 */
                <div className="case-html prose prose-slate max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                </div>
              ) : qdrantCase?.fullText ? (
                <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {qdrantCase.fullText}
                </div>
              ) : (
                !qdrantLoading && !sqlLoading && (
                  <ErrorBox message="No complete case body found." />
                )
              )}
            </div>
          )}

          {/* DETAILED SUMMARY TAB */}
          {activeTab === "summary" && (
            <div className="space-y-6">
              {summaryLoading ? (
                <Loader text="Generating or loading detailed summary…" />
              ) : summaryError ? (
                <ErrorBox message={summaryError} />
              ) : detailedSummary && sections ? (
                <>
                  <SectionCard title="Overview">
                    <div className="text-sm leading-7 text-slate-700">
                      {sections.overview || "Not available."}
                    </div>
                  </SectionCard>
                  <SectionCard title="Facts">
                    <div className="text-sm leading-7 text-slate-700">
                      {sections.facts || "Not available."}
                    </div>
                  </SectionCard>
                  <SectionCard title="Procedural history">
                    <div className="text-sm leading-7 text-slate-700">
                      {sections.proceduralHistory || "Not available."}
                    </div>
                  </SectionCard>
                  <SectionCard title="Issues">
                    <BulletList items={sections.issues} />
                  </SectionCard>
                  <SectionCard title="Holding">
                    <div className="text-sm leading-7 text-slate-700">
                      {sections.holding || "Not available."}
                    </div>
                  </SectionCard>
                  <SectionCard title="Reasoning">
                    <div className="text-sm leading-7 text-slate-700">
                      {sections.reasoning || "Not available."}
                    </div>
                  </SectionCard>
                  <SectionCard title="Statutes and articles">
                    <BulletList items={sections.statutesAndArticles} />
                  </SectionCard>
                  <SectionCard title="Precedents discussed">
                    <BulletList items={sections.precedentsDiscussed} />
                  </SectionCard>
                  <SectionCard title="Final disposition">
                    <div className="text-sm leading-7 text-slate-700">
                      {sections.finalDisposition || "Not available."}
                    </div>
                  </SectionCard>
                  <SectionCard title="Bench">
                    <BulletList items={sections.bench} />
                  </SectionCard>
                  <SectionCard title="Key takeaways">
                    <BulletList items={sections.keyTakeaways} />
                  </SectionCard>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* ── CHAT FAB ── */}
        <button
          type="button"
          onClick={() => setChatOpen((prev) => !prev)}
          className="absolute bottom-6 right-6 inline-flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-[#114C8D] text-white shadow-[0_18px_50px_rgba(17,76,141,0.35)] transition hover:bg-[#0B3A6E]"
          aria-label="Open case-only chat"
        >
          <ChatIcon />
        </button>

        {/* ── CHAT PANEL ── */}
        {chatOpen && (
          <div className="absolute bottom-24 right-6 flex h-[460px] w-[360px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.2)]">
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Case-only chat</div>
                  <div className="mt-1 text-xs text-slate-500">Ask only about this case</div>
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

            <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              <div className="space-y-4">
                {chatMessages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-[14px] leading-6 ${isUser ? "bg-[#114C8D] text-white" : "text-slate-700"
                          }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  );
                })}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[88%] rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 shadow-sm">
                      Thinking about this case…
                    </div>
                  </div>
                )}
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