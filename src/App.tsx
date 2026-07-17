import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import mammoth from "mammoth";
import { useSpeechInput } from "./hooks/useSpeechInput";
import { extractAllowedCourtsFromUser } from "./lib/allowedCourts";

import {
  streamChat,
  type CaseDigest,
  type SourceItem,
  type StreamTrace,
} from "./streamChat";
import Sidebar from "./components/Sidebar";
import CaseModal from "./components/CaseModal";
import AuthScreen from "./components/AuthScreen";
import BookmarksPage from "./components/BookmarksPage";
import CreditsPage from "./components/CreditsPage";
import WorkspacePane from "./components/workspace/WorkspacePane";
import DraftingDock from "./components/drafting/DraftingDock";
import { useAuth } from "./context/AuthContext";
import TopNavigation from "./components/TopNavigation";

import SettingsPage from "./components/settings/SettingsPage";
import {
  draftingSettingsService,
  type DraftingSettings,
} from "./services/draftingSettingsService";
import { draftDocumentService } from "./services/draftDocumentService";
import {
  draftAttachmentService,
  type DraftAttachment,
} from "./services/draftAttachmentService";

import {
  conversationService,
  type ConversationChatMode,
  type ConversationListItem,
} from "./services/conversationService";
import {
  bookmarkService,
  type BookmarkedCase,
} from "./services/bookmarkService";
import {
  buildStreamingThoughts,
  deriveConversationTitle,
  getCaseKeyFromDigest,
  mapStoredMessages,
  bookmarkToCaseDigest,
  SUGGESTIONS,
  type AppMessage,
} from "./lib/appHelpers";

import {
  getChatModeForView,
  getDraftingAnswerTypeFromTrace,
  getViewForChatMode,
  makeDraftingChatSummary,
  makeWorkspaceStarterMessage,
  type WorkspaceView,
} from "./lib/workspaceMode";
import {
  buildConversationPath,
  buildViewPath,
  getRouteState,
} from "./lib/appRoutes";

type Message = AppMessage;

const MAX_INPUT_LENGTH = 1000;
const TYPING_SPEED_MS = 16;
const DRAFT_AUTOSAVE_DELAY_MS = 2500;

const DRAFTING_SUGGESTIONS = [
  "Draft a legal notice for non-payment of invoice.",
  "Draft a reply to a breach of contract allegation.",
  "Draft a service agreement protective of the provider.",
  "Draft a cease and desist notice for trademark misuse.",
];

function uuid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getDraftingArtifacts(messages: Message[]) {
  const transformed = messages.map((message) => {
    if (message.role !== "assistant") return message;

    const answerType = getDraftingAnswerTypeFromTrace(message.trace);
    if (answerType !== "drafting_draft") return message;

    return {
      ...message,
      content: makeDraftingChatSummary(message.trace, message.content),
      streaming: false,
    };
  });

  return {
    messages: transformed,
  };
}

function getDraftContentFromDocument(document: any) {
  if (typeof document?.draftHtml === "string" && document.draftHtml.trim()) {
    return document.draftHtml;
  }

  if (
    typeof document?.draftMarkdown === "string" &&
    document.draftMarkdown.trim()
  ) {
    return document.draftMarkdown;
  }

  return "";
}

function normalizeDraftTitleText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSubjectPrefixFromTitle(value: unknown) {
  return normalizeDraftTitleText(value)
    .replace(/^subject\s*[:\-]\s*/i, "")
    .trim();
}

function countBracketPlaceholdersInTitle(value: string) {
  return (String(value || "").match(/\[[^\]]+\]/g) || []).length;
}

function looksLikeContactOrAddressTitleLine(value: string) {
  const normalized = normalizeDraftTitleText(value);
  const v = normalized.toLowerCase();
  if (!v) return true;

  if (/@/.test(v)) return true;
  if (/^\+?[\d\s().-]{7,}$/.test(v)) return true;
  if (/\b\d{6}\b/.test(v)) return true;
  if (/^(date|dated)\s*[:\-]/.test(v)) return true;
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(v)) return true;
  if (/^to[,]?$/.test(v) || /^dear\b/.test(v)) return true;

  const addressSignals = [
    "road",
    "street",
    "lane",
    "avenue",
    "floor",
    "tower",
    "building",
    "block",
    "sector",
    "society",
    "nagar",
    "colony",
    "district",
    "state",
    "india",
    "gujarat",
    "ahmedabad",
    "mumbai",
    "delhi",
    "pincode",
    "zip code",
    "pin code",
  ];

  if (addressSignals.some((signal) => v.includes(signal))) {
    return true;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && /^[a-z .'-]+$/i.test(normalized) && !/\b(vs\.?|v\.)\b/i.test(normalized)) {
    return true;
  }

  return false;
}

function hasStrongDraftTitleSignal(value: string) {
  const normalized = normalizeDraftTitleText(value);
  if (!normalized) return false;

  if (/^subject\s*[:\-]/i.test(normalized)) return true;

  return /\b(legal notice|notice|reply|agreement|contract|deed|affidavit|petition|application|undertaking|complaint|plaint|appeal|memorandum|invoice|demand|cease and desist|lease|nda|service agreement|employment|appointment|termination|settlement|breach|non-payment|payment|arbitration|indemnity|power of attorney|terms and conditions)\b/i.test(
    normalized
  );
}

function looksLikeWeakDraftTitle(value: string) {
  const v = normalizeDraftTitleText(value).toLowerCase();
  if (!v) return true;

  if (
    v === "new chat" ||
    v === "untitled draft" ||
    v === "markdown" ||
    v === "text" ||
    v === "plain text" ||
    v === "frontend-lawsuit" ||
    /^```/.test(v)
  ) {
    return true;
  }

  if (countBracketPlaceholdersInTitle(v) >= 1) {
    return true;
  }

  if (looksLikeContactOrAddressTitleLine(v)) {
    return true;
  }

  const words = v.split(/\s+/).filter(Boolean);
  if (!hasStrongDraftTitleSignal(v) && (words.length < 3 || words.length > 14)) {
    return true;
  }

  return false;
}

function extractExplicitSubjectTitleFromDraft(value: string) {
  const plainDraft = stripHtmlToPlainTextApp(String(value || ""));
  const lines = plainDraft
    .split(/\n+/)
    .map((line) => normalizeDraftTitleText(line))
    .filter(Boolean);

  const subjectLine = lines.find((line) => /^subject\s*[:\-]/i.test(line));
  if (!subjectLine) return "";

  const cleaned = stripSubjectPrefixFromTitle(subjectLine);
  return looksLikeWeakDraftTitle(cleaned) ? "" : cleaned;
}

function extractHtmlHeadingTitle(value: string) {
  const source = String(value || "");
  if (!source.trim() || typeof DOMParser === "undefined") return "";

  try {
    const doc = new DOMParser().parseFromString(source, "text/html");
    const heading =
      (doc.querySelector("h1.doc-title") as HTMLElement | null) ||
      (doc.querySelector("h1") as HTMLElement | null);

    const text = normalizeDraftTitleText(heading?.textContent || "");
    return looksLikeWeakDraftTitle(text) ? "" : text;
  } catch {
    return "";
  }
}


function stripHtmlToPlainTextApp(value: string) {
  const source = String(value || "");
  if (!source.trim()) return "";

  if (/<\/?[a-z][\s\S]*>/i.test(source) && typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(source, "text/html");
      return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    } catch {
      return source.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  return source
    .replace(/^```(?:markdown|md|text|txt)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^markdown\s*/i, "")
    .replace(/\r/g, "")
    .trim();
}

function deriveCleanDraftTitle(params: {
  rawTitle?: string | null;
  draftText?: string | null;
  fallback?: string | null;
}) {
  const htmlHeadingTitle = extractHtmlHeadingTitle(String(params.draftText || ""));
  if (htmlHeadingTitle) {
    return htmlHeadingTitle.length > 120
      ? `${htmlHeadingTitle.slice(0, 117).trim()}...`
      : htmlHeadingTitle;
  }

  const explicitSubject = extractExplicitSubjectTitleFromDraft(
    String(params.draftText || "")
  );
  if (explicitSubject) {
    return explicitSubject.length > 120
      ? `${explicitSubject.slice(0, 117).trim()}...`
      : explicitSubject;
  }

  const rawTitle = stripSubjectPrefixFromTitle(params.rawTitle || "");
  if (rawTitle && !looksLikeWeakDraftTitle(rawTitle)) {
    return rawTitle.length > 120
      ? `${rawTitle.slice(0, 117).trim()}...`
      : rawTitle;
  }

  const fallback = stripSubjectPrefixFromTitle(params.fallback || "");
  if (fallback && !looksLikeWeakDraftTitle(fallback)) {
    return fallback.length > 120
      ? `${fallback.slice(0, 117).trim()}...`
      : fallback;
  }

  const plainDraft = stripHtmlToPlainTextApp(String(params.draftText || ""));
  const draftLines = plainDraft
    .split(/\n+/)
    .map((line) => normalizeDraftTitleText(line))
    .filter(Boolean);

  for (const line of draftLines.slice(0, 12)) {
    const cleaned = stripSubjectPrefixFromTitle(line);
    if (!looksLikeWeakDraftTitle(cleaned) && hasStrongDraftTitleSignal(cleaned)) {
      return cleaned.length > 120
        ? `${cleaned.slice(0, 117).trim()}...`
        : cleaned;
    }
  }

  return "Untitled draft";
}

function DraftToggleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
      <path d="M9 8h1" />
    </svg>
  );
}

function CreditsLockedOverlay({
  onBuyCredits,
  onLogout,
}: {
  onBuyCredits: () => void;
  onLogout: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_30px_120px_rgba(15,23,42,0.25)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#114C8D] text-white">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1v22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-[24px] font-semibold text-slate-900">
            You are out of credits
          </h2>

          <p className="mt-3 text-[15px] leading-7 text-slate-600">
            You need to buy more credits to continue using Judgment Mode,
            Drafting Studio, and the rest of the AI tools.
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onBuyCredits}
            className="cursor-pointer inline-flex items-center justify-center rounded-2xl bg-[#114C8D] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#0B3A6E]"
          >
            Buy credits
          </button>

          <button
            type="button"
            onClick={() => {
              void onLogout();
            }}
            className="cursor-pointer inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading, logout, setCreditsRemaining } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const routeState = useMemo(
    () => getRouteState(location.pathname),
    [location.pathname]
  );

  const activeView = routeState.activeView;
  const workspaceView = routeState.workspaceView;
  const activeConversationId = workspaceView ? routeState.conversationId : null;

  const sidebarWorkspaceView: WorkspaceView = workspaceView ?? "chat";
  const sidebarChatMode = getChatModeForView(sidebarWorkspaceView);
  const currentChatMode = workspaceView ? getChatModeForView(workspaceView) : null;
  const isDraftingMode = workspaceView === "drafting_document";

  const [draftingSettings, setDraftingSettings] =
    useState<DraftingSettings | null>(null);
  const [draftingSettingsLoading, setDraftingSettingsLoading] = useState(false);

  const [isDraftDockOpen, setIsDraftDockOpen] = useState(false);

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    makeWorkspaceStarterMessage("chat"),
  ]);
  const [chatInput, setChatInput] = useState("");
  const [draftingInput, setDraftingInput] = useState("");

  const activeInput = isDraftingMode ? draftingInput : chatInput;

  const creditsRemaining = typeof user?.creditsRemaining === "number" ? user.creditsRemaining : 0;

  const creditsLocked = Boolean(user) && creditsRemaining <= 0;

  const setActiveInput = (value: string) => {
    if (isDraftingMode) {
      setDraftingInput(value);
      return;
    }

    setChatInput(value);
  };
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [selectedCase, setSelectedCase] = useState<CaseDigest | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkedCase[]>([]);
  const [loadingThoughtIndex, setLoadingThoughtIndex] = useState(0);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [draftDocumentLoading, setDraftDocumentLoading] = useState(false);
  const [caseModalTab, setCaseModalTab] = useState<"case" | "summary">("case");
  const [draftDocumentIdsByConversation, setDraftDocumentIdsByConversation] =
    useState<Record<string, string>>({});
  const [draftContentsByConversation, setDraftContentsByConversation] =
    useState<Record<string, string>>({});
  const [draftTitlesByConversation, setDraftTitlesByConversation] =
    useState<Record<string, string>>({});
  const [draftAttachmentsByConversation, setDraftAttachmentsByConversation] =
    useState<Record<string, DraftAttachment[]>>({});
  const [uploadingDraftAttachment, setUploadingDraftAttachment] = useState(false);
const availableCourts = useMemo(
  () => extractAllowedCourtsFromUser(user),
  [user]
);

const courtFilterStorageKey = useMemo(
  () =>
    user?.id
      ? `lawsuit:court-filter:${user.id}`
      : "lawsuit:court-filter:guest",
  [user?.id]
);

const [selectedCourtIds, setSelectedCourtIds] = useState<number[]>([]);
const [courtFilterHydrated, setCourtFilterHydrated] = useState(false);

const handleDeleteConversation = async (conversationId: string) => {
  const deletedConversation = conversations.find(
    (item) => item.id === conversationId
  );

  await conversationService.remove(conversationId);

  setConversations((prev) =>
    prev.filter((item) => item.id !== conversationId)
  );

  setDraftDocumentIdsByConversation((prev) => {
    const next = { ...prev };
    delete next[conversationId];
    return next;
  });

  setDraftContentsByConversation((prev) => {
    const next = { ...prev };
    delete next[conversationId];
    return next;
  });

  setDraftTitlesByConversation((prev) => {
    const next = { ...prev };
    delete next[conversationId];
    return next;
  });

  setDraftAttachmentsByConversation((prev) => {
    const next = { ...prev };
    delete next[conversationId];
    return next;
  });

  if (activeConversationId === conversationId) {
    const deletedView =
      deletedConversation?.chatMode === "drafting_studio"
        ? "drafting_document"
        : "chat";

    navigate(buildViewPath(deletedView), { replace: true });
    setMessages([makeWorkspaceStarterMessage(deletedView)]);
    setActiveAssistantId(null);
    setLoading(false);
    setPhase("");
  }
};

useEffect(() => {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(courtFilterStorageKey);
    if (!raw) {
      setSelectedCourtIds([]);
      setCourtFilterHydrated(true);
      return;
    }

    const parsed = JSON.parse(raw);
    const normalized = Array.isArray(parsed)
      ? parsed
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item))
      : [];

    setSelectedCourtIds(normalized);
  } catch {
    setSelectedCourtIds([]);
  } finally {
    setCourtFilterHydrated(true);
  }
}, [courtFilterStorageKey]);

useEffect(() => {
  if (!courtFilterHydrated) return;

  const allowed = new Set(availableCourts.map((item) => item.id));

  setSelectedCourtIds((prev) => {
    const filtered = prev.filter((id) => allowed.has(id));
    const changed =
      filtered.length !== prev.length ||
      filtered.some((id, index) => id !== prev[index]);

    return changed ? filtered : prev;
  });
}, [availableCourts, courtFilterHydrated]);

useEffect(() => {
  if (!courtFilterHydrated || typeof window === "undefined") return;

  window.localStorage.setItem(
    courtFilterStorageKey,
    JSON.stringify(selectedCourtIds)
  );
}, [selectedCourtIds, courtFilterHydrated, courtFilterStorageKey]);


  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeAssistantRef = useRef<HTMLDivElement | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const finalizingAssistantIdRef = useRef<string | null>(null);

  const typingQueueRef = useRef<string[]>([]);
  const typingTimerRef = useRef<number | null>(null);
  const finalizePendingRef = useRef<{
    pending: boolean;
    fallback?: string;
    assistantMessageId?: string | null;
  }>({ pending: false });

  const activeDraftAnswerTypeRef = useRef<
    "drafting_questions" | "drafting_draft" | null
  >(null);
  const draftStreamBufferRef = useRef("");
  const pendingInitialMessageConversationRef = useRef<string | null>(null);
  const draftDocumentIdsRef = useRef<Record<string, string>>({});
  const draftTitlesRef = useRef<Record<string, string>>({});
  const draftSaveTimersRef = useRef<Record<string, number | null>>({});

  const clearAssistantTracking = () => {
    setActiveAssistantId(null);
    activeAssistantIdRef.current = null;
    finalizingAssistantIdRef.current = null;
  };

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ||
      null,
    [conversations, activeConversationId]
  );

  const activeConversationTitle =
    activeConversation?.title || (isDraftingMode ? "Drafting Studio" : "New chat");

  const currentDraftDocumentId =
    (activeConversationId && draftDocumentIdsByConversation[activeConversationId]) ||
    null;

  const currentDraftText =
    (activeConversationId && draftContentsByConversation[activeConversationId]) || "";

  const currentDraftTitle =
    (activeConversationId && draftTitlesByConversation[activeConversationId]) || "";

  const currentDraftAttachments =
    (activeConversationId && draftAttachmentsByConversation[activeConversationId]) || [];

const speechInputBaseRef = useRef("");

const draftingSpeech = useSpeechInput({
  enabled: isDraftingMode,
  languageHint: "en-IN",
  onRecordingStart: () => {
    speechInputBaseRef.current = draftingInput.trimEnd();
  },
  onInterimTranscript: (text) => {
    const base = speechInputBaseRef.current.trimEnd();
    const interim = String(text || "").trim();

    const nextValue = interim
      ? base
        ? `${base}\n${interim}`
        : interim
      : base;

    setDraftingInput(nextValue.slice(0, MAX_INPUT_LENGTH));
  },
  onFinalTranscript: (text) => {
    const base = speechInputBaseRef.current.trimEnd();
    const finalText = String(text || "").trim();

    if (!finalText) {
      setDraftingInput(base.slice(0, MAX_INPUT_LENGTH));
      return;
    }

    const nextValue = base ? `${base}\n${finalText}` : finalText;
    const clipped = nextValue.slice(0, MAX_INPUT_LENGTH);

    speechInputBaseRef.current = clipped;
    setDraftingInput(clipped);
    focusComposer();
  },
  onCancelRestore: () => {
    setDraftingInput(speechInputBaseRef.current.slice(0, MAX_INPUT_LENGTH));
  },
});

  const dockConversationTitle = currentDraftTitle || activeConversationTitle;

  const lastAssistant = [...messages].reverse().find(
    (message) => message.role === "assistant"
  );
  const activeTrace = lastAssistant?.trace || null;

  const streamingThoughts = useMemo(
    () => buildStreamingThoughts(phase, activeTrace),
    [phase, activeTrace]
  );

  const activeLoadingThought =
    streamingThoughts[loadingThoughtIndex] || phase || "Thinking";

  useEffect(() => {
    activeAssistantIdRef.current = activeAssistantId;
  }, [activeAssistantId]);

const canSend = useMemo(
  () =>
    activeInput.trim().length > 0 &&
    activeInput.trim().length <= MAX_INPUT_LENGTH &&
    !loading &&
    Boolean(workspaceView) &&
    (user?.creditsRemaining ?? 0) > 0,
  [activeInput, loading, workspaceView]
);

  const hasUserMessages = messages.some((message) => message.role === "user");

  const bookmarkIndex = useMemo(() => {
    const map = new Map<string, BookmarkedCase>();

    for (const bookmark of bookmarks) {
      map.set(getCaseKeyFromDigest(bookmark), bookmark);
    }

    return map;
  }, [bookmarks]);

  const draftingSources = useMemo(() => {
    return isDraftingMode ? lastAssistant?.sources || [] : [];
  }, [isDraftingMode, lastAssistant]);

  const draftingRouter = useMemo(() => {
    if (!isDraftingMode) return null;
    const router = lastAssistant?.trace?.router;
    return router && typeof router === "object"
      ? (router as Record<string, unknown>)
      : null;
  }, [isDraftingMode, lastAssistant]);

  const brandingForDock = useMemo(() => {
    if (!draftingSettings) {
      return {
        mode: "none" as const,
        lockBranding: true,
      };
    }

    return {
      mode:
        draftingSettings.draftingBrandingMode === "HEADER_FOOTER"
          ? ("header_footer" as const)
          : draftingSettings.draftingBrandingMode === "LETTERHEAD"
          ? ("letterhead" as const)
          : ("none" as const),
      headerImageUrl: draftingSettings.draftingHeaderImageUrl || null,
      footerImageUrl: draftingSettings.draftingFooterImageUrl || null,
      letterheadImageUrl: draftingSettings.draftingLetterheadImageUrl || null,
      signatureImageUrl: draftingSettings.draftingSignatureImageUrl || null,
      headerHeightPx: draftingSettings.draftingHeaderHeightPx || 110,
      footerHeightPx: draftingSettings.draftingFooterHeightPx || 90,
      letterheadHeightPx: draftingSettings.draftingLetterheadHeightPx || 130,
      lockBranding:
        typeof draftingSettings.draftingLockBranding === "boolean"
          ? draftingSettings.draftingLockBranding
          : true,
    };
  }, [draftingSettings]);

  const draftingAnswerType =
    typeof draftingRouter?.answerType === "string"
      ? draftingRouter.answerType
      : null;

  const draftingMissingFields = Array.isArray(draftingRouter?.missingFields)
    ? draftingRouter.missingFields
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

  const draftingExtractedFacts =
    draftingRouter?.extractedFacts &&
    typeof draftingRouter?.extractedFacts === "object"
      ? (draftingRouter.extractedFacts as Record<string, unknown>)
      : {};

  const draftingPlaceholderValues = useMemo(() => {
    return Object.fromEntries(
      Object.entries(draftingExtractedFacts)
        .filter(([, value]) =>
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        )
        .map(([key, value]) => [key, String(value ?? "")])
        .filter(([key, value]) => key && value)
    ) as Record<string, string>;
  }, [draftingExtractedFacts]);

  const draftingObjective =
    typeof draftingRouter?.draftingObjective === "string"
      ? draftingRouter.draftingObjective
      : "";

  const modeSuggestions = isDraftingMode ? DRAFTING_SUGGESTIONS : SUGGESTIONS;
  const composerPlaceholder = isDraftingMode
    ? "Describe the legal draft you wanna create..."
    : "Ask about a case, doctrine, holding, citation, or comparison...";
  const greetingTitle = isDraftingMode
    ? "What would you like to draft today?"
    : "How can I assist you today?";

  const hasDraftAvailable =
    !!currentDraftText.trim() || !!currentDraftDocumentId || draftDocumentLoading;

  const shouldRenderDraftDock = isDraftingMode && isDraftDockOpen;

  // useEffect(() => {
  //   const allowed = new Set(availableCourts.map((item) => item.id));
  //   setSelectedCourtIds((prev) => prev.filter((id) => allowed.has(id)));
  // }, [availableCourts]);

  const canToggleDraftDock =
    isDraftingMode &&
    (
      hasDraftAvailable ||
      phase === "Generating draft" ||
      draftingAnswerType === "drafting_draft" ||
      activeDraftAnswerTypeRef.current === "drafting_draft"
    );

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  };

  const focusComposer = () => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const scrollToActiveAssistantStart = (behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      activeAssistantRef.current?.scrollIntoView({
        behavior,
        block: "start",
      });
    });
  };

  const clearTypingTimer = () => {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  };

  const resetTypingEngine = () => {
    clearTypingTimer();
    typingQueueRef.current = [];
    finalizePendingRef.current = {
      pending: false,
      fallback: undefined,
      assistantMessageId: undefined,
    };
  };

  const clearDraftSaveTimer = (conversationId: string) => {
    const timer = draftSaveTimersRef.current[conversationId];
    if (timer) {
      window.clearTimeout(timer);
    }
    draftSaveTimersRef.current[conversationId] = null;
  };

const updateAssistantMessage = (updater: (message: Message) => Message) => {
  setMessages((prev) => {
    if (!prev.length) return prev;

    const next = [...prev];
    const preferredId =
      activeAssistantIdRef.current ?? finalizingAssistantIdRef.current;

    let targetIndex =
      preferredId != null
        ? next.findIndex((message) => message.id === preferredId)
        : -1;

    if (targetIndex < 0) {
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (next[index]?.role === "assistant" && next[index]?.streaming) {
          targetIndex = index;
          break;
        }
      }
    }

    if (targetIndex < 0) return prev;

    const target = next[targetIndex];
    if (!target || target.role !== "assistant") return prev;

    next[targetIndex] = updater(target);
    return next;
  });
};

const finalizeAssistantMessage = (
  fallbackText?: string,
  assistantMessageId?: string | null
) => {
  updateAssistantMessage((last) => {
    const finalContent =
      last.content.trim().length > 0 ? last.content : fallbackText || "";

    return {
      ...last,
      id: assistantMessageId || last.id,
      content: finalContent,
      streaming: false,
    };
  });

  clearAssistantTracking();
};

  const maybeFinalizeAfterTyping = () => {
    if (
      typingQueueRef.current.length === 0 &&
      typingTimerRef.current === null &&
      finalizePendingRef.current.pending
    ) {
      const fallback = finalizePendingRef.current.fallback;
      const assistantMessageId = finalizePendingRef.current.assistantMessageId;
      finalizePendingRef.current = {
        pending: false,
        fallback: undefined,
        assistantMessageId: undefined,
      };
      finalizeAssistantMessage(fallback, assistantMessageId);
    }
  };

  const appendAssistantCharacter = (char: string) => {
    if (!char) return;

    updateAssistantMessage((last) => ({
      ...last,
      content: last.content + char,
      streaming: true,
    }));
  };

  const startTypingDrain = () => {
    if (typingTimerRef.current !== null) return;

    const tick = () => {
      const nextChar = typingQueueRef.current.shift();

      if (!nextChar) {
        clearTypingTimer();
        maybeFinalizeAfterTyping();
        return;
      }

      appendAssistantCharacter(nextChar);

      const nextDelay = nextChar === " " ? 8 : TYPING_SPEED_MS;
      typingTimerRef.current = window.setTimeout(tick, nextDelay);
    };

    typingTimerRef.current = window.setTimeout(tick, TYPING_SPEED_MS);
  };

  const enqueueAssistantDelta = (text: string) => {
    if (!text) return;
    typingQueueRef.current.push(...Array.from(text));
    startTypingDrain();
  };

  const syncDraftAnswerType = (trace?: StreamTrace | null) => {
    const answerType = getDraftingAnswerTypeFromTrace(trace);

    if (!answerType) return;

    activeDraftAnswerTypeRef.current = answerType;

    if (isDraftingMode && answerType === "drafting_draft") {
      updateAssistantMessage((last) => ({
        ...last,
        content:
          last.content ||
          "I’m preparing the draft in the editor now. I’ll keep the chat concise while the full document is being structured on the right. Once it is ready, please review the facts, placeholders, and wording carefully before using it.",
        streaming: true,
      }));
    }
  };

  const attachAssistantMeta = ({
    sources,
    caseDigests,
    trace,
  }: {
    sources?: SourceItem[];
    caseDigests?: CaseDigest[];
    trace?: StreamTrace | null;
  }) => {
    syncDraftAnswerType(trace);

    updateAssistantMessage((last) => ({
      ...last,
      sources:
        Array.isArray(sources) && sources.length > 0
          ? sources
          : last.sources || [],
      caseDigests:
        Array.isArray(caseDigests) && caseDigests.length > 0
          ? caseDigests
          : last.caseDigests || [],
      trace: trace ?? last.trace ?? null,
    }));
  };

  const mergeIncomingWithOptimisticAssistant = (
    view: WorkspaceView,
    incoming: Message[],
    previous: Message[]
  ) => {
    const starter = makeWorkspaceStarterMessage(view);
    const base = incoming.length ? incoming : [starter];

    const optimisticAssistant = [...previous]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          (message.streaming || message.id === activeAssistantIdRef.current)
      );

    if (!optimisticAssistant) {
      return base;
    }

    const alreadyPresent = base.some(
      (message) => message.id === optimisticAssistant.id
    );

    if (alreadyPresent) {
      return base;
    }

    const lastIncoming = base[base.length - 1];

    if (lastIncoming?.role === "assistant") {
      return base;
    }

    return [...base, optimisticAssistant];
  };

  const applyMessagesForWorkspace = (
    view: WorkspaceView,
    _conversationId: string | null,
    nextMessages: Message[]
  ) => {
    const normalized =
      view === "drafting_document"
        ? getDraftingArtifacts(nextMessages).messages
        : nextMessages;

    setMessages((prev) =>
      mergeIncomingWithOptimisticAssistant(view, normalized, prev)
    );
  };

  const loadConversations = async (chatMode: ConversationChatMode) => {
    const response = await conversationService.list(chatMode);
    setConversations(response.conversations);
    return response.conversations;
  };

  const extractTextFromDraftFile = async (file: File) => {
    const lowerName = file.name.toLowerCase();

    if (
      file.type === "text/plain" ||
      file.type === "text/markdown" ||
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md")
    ) {
      return (await file.text()).trim();
    }

    if (
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx")
    ) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return String(result.value || "").trim();
    }

    throw new Error("Supported formats for now: .txt, .md, .docx");
  };

  const ensureDraftingConversationForUpload = async () => {
    if (activeConversationId) return activeConversationId;

    const chatMode = getChatModeForView("drafting_document");
    const response = await conversationService.create("New chat", chatMode);

    const newConversation: ConversationListItem = {
      id: response.conversation.id,
      title: response.conversation.title,
      chatMode: response.conversation.chatMode,
      createdAt: response.conversation.createdAt,
      updatedAt: response.conversation.updatedAt,
      messageCount: 0,
      preview: "",
      lastMessageRole: null,
      lastMessageAt: response.conversation.updatedAt,
    };

    setConversations((prev) => [newConversation, ...prev]);
    setDraftContentsByConversation((prev) => ({
      ...prev,
      [newConversation.id]: "",
    }));
    setDraftTitlesByConversation((prev) => ({
      ...prev,
      [newConversation.id]: response.conversation.title || "Untitled draft",
    }));
    setDraftDocumentIdsByConversation((prev) => ({
      ...prev,
      [newConversation.id]: "",
    }));
    setDraftAttachmentsByConversation((prev) => ({
      ...prev,
      [newConversation.id]: [],
    }));

    navigate(buildConversationPath("drafting_document", newConversation.id), {
      replace: true,
    });

    return newConversation.id;
  };

  const handleRemoveDraftAttachment = (attachmentId: string) => {
  if (!activeConversationId) return;

  setDraftAttachmentsByConversation((prev) => ({
    ...prev,
    [activeConversationId]: (prev[activeConversationId] || []).filter(
      (item) => item.id !== attachmentId
    ),
  }));
};

  const handleDraftFileUpload = async (file: File) => {
    if (!isDraftingMode) return;

    try {
      setUploadingDraftAttachment(true);

      const conversationId = await ensureDraftingConversationForUpload();
      const text = await extractTextFromDraftFile(file);

      if (!text.trim()) {
        throw new Error("Could not extract text from the uploaded file.");
      }

      const response = await draftAttachmentService.upload({
        conversationId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        text,
      });

      setDraftAttachmentsByConversation((prev) => {
        const current = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: [response.attachment, ...current],
        };
      });
    } catch (error) {
      console.error("Failed to upload drafting format", error);
    } finally {
      setUploadingDraftAttachment(false);
    }
  };

  const hydrateDraftDocumentForConversation = async (
    conversationId: string,
    preferredDocumentId?: string | null
  ) => {
    setDraftDocumentLoading(true);

    try {
      let documentId =
        preferredDocumentId ||
        draftDocumentIdsRef.current[conversationId] ||
        null;

      if (!documentId) {
        const listResponse = await draftDocumentService.listByConversation(
          conversationId
        );

        const latestDocument = Array.isArray(listResponse?.documents)
          ? listResponse.documents[0]
          : null;

        documentId = latestDocument?.id || null;
      }

      if (!documentId) {
        setDraftDocumentIdsByConversation((prev) => ({
          ...prev,
          [conversationId]: "",
        }));
        setDraftContentsByConversation((prev) => ({
          ...prev,
          [conversationId]: "",
        }));
        setDraftTitlesByConversation((prev) => ({
          ...prev,
          [conversationId]: "",
        }));
        return null;
      }

      const documentResponse = await draftDocumentService.getDocument(documentId);
      const document = documentResponse?.document;

      if (!document?.id) {
        return null;
      }

      const nextContent = getDraftContentFromDocument(document);
      const nextTitle = deriveCleanDraftTitle({
        rawTitle: String(document.title || "").trim(),
        draftText: nextContent,
        fallback:
          conversations.find((item) => item.id === conversationId)?.title || "",
      });

      setDraftDocumentIdsByConversation((prev) => ({
        ...prev,
        [conversationId]: document.id,
      }));
      setDraftContentsByConversation((prev) => ({
        ...prev,
        [conversationId]: nextContent,
      }));
      setDraftTitlesByConversation((prev) => ({
        ...prev,
        [conversationId]: nextTitle,
      }));

      return document;
    } catch (error) {
      console.error("Failed to hydrate draft document", error);
      return null;
    } finally {
      setDraftDocumentLoading(false);
    }
  };

  const scheduleDraftPersist = (
    conversationId: string,
    html: string,
    explicitTitle?: string
  ) => {
    clearDraftSaveTimer(conversationId);

    draftSaveTimersRef.current[conversationId] = window.setTimeout(async () => {
      const documentId = draftDocumentIdsRef.current[conversationId];
      if (!documentId) return;

      const title = deriveCleanDraftTitle({
        rawTitle:
          explicitTitle ??
          draftTitlesRef.current[conversationId] ??
          conversations.find((item) => item.id === conversationId)?.title ??
          "Untitled draft",
        draftText: html,
        fallback: conversations.find((item) => item.id === conversationId)?.title ?? "",
      });

      try {
        const response = await draftDocumentService.updateDocument(documentId, {
          title,
          draftHtml: html,
          status: "DRAFT",
        });

        const updatedDocument = response?.document;
        if (!updatedDocument) return;

        const nextContent = getDraftContentFromDocument(updatedDocument);
        const nextTitle = String(updatedDocument.title || title || "").trim();

        setDraftContentsByConversation((prev) => ({
          ...prev,
          [conversationId]: nextContent || html,
        }));
        setDraftTitlesByConversation((prev) => ({
          ...prev,
          [conversationId]: nextTitle,
        }));
      } catch (error) {
        console.error("Failed to autosave draft document", error);
      }
    }, DRAFT_AUTOSAVE_DELAY_MS);
  };
  
  const handleSelectConversation = async (conversationId: string) => {
    if (loading) return;

    const conversation = conversations.find((item) => item.id === conversationId);
    const targetView = conversation
      ? getViewForChatMode(conversation.chatMode)
      : "chat";

    navigate(buildConversationPath(targetView, conversationId));
  };

  const handleNewConversation = async (view?: "chat" | "drafting_document") => {
    const targetView = view || workspaceView || "chat";
    const chatMode = getChatModeForView(targetView);

    const response = await conversationService.create("New chat", chatMode);

    const newConversation: ConversationListItem = {
      id: response.conversation.id,
      title: response.conversation.title,
      chatMode: response.conversation.chatMode,
      createdAt: response.conversation.createdAt,
      updatedAt: response.conversation.updatedAt,
      messageCount: 0,
      preview: "",
      lastMessageRole: null,
      lastMessageAt: response.conversation.updatedAt,
    };

    setConversations((prev) => [newConversation, ...prev]);
    setMessages([makeWorkspaceStarterMessage(targetView)]);
    setActiveInput("");

    if (targetView === "drafting_document") {
      setDraftContentsByConversation((prev) => ({
        ...prev,
        [newConversation.id]: "",
      }));
      setDraftTitlesByConversation((prev) => ({
        ...prev,
        [newConversation.id]: response.conversation.title || "Untitled draft",
      }));
      setDraftDocumentIdsByConversation((prev) => ({
        ...prev,
        [newConversation.id]: "",
      }));
      setDraftAttachmentsByConversation((prev) => ({
        ...prev,
        [newConversation.id]: [],
      }));
      setIsDraftDockOpen(false);
    }

    navigate(buildConversationPath(targetView, newConversation.id));
    focusComposer();
  };

  const handleCaseOpen = (item: CaseDigest) => {
    setCaseModalTab("case");
    setSelectedCase(item);
  };

  const handleCaseSummarize = (item: CaseDigest) => {
    setCaseModalTab("summary");
    setSelectedCase(item);
  };

  const handlePdfClick = (item: CaseDigest) => {
    setCaseModalTab("case");
    setSelectedCase(item);
  };

  const handleToggleBookmark = async (item: CaseDigest) => {
    const key = getCaseKeyFromDigest(item);
    const existing = bookmarkIndex.get(key);

    if (existing) {
      await bookmarkService.remove(existing.id);
      setBookmarks((prev) =>
        prev.filter((bookmark) => bookmark.id !== existing.id)
      );
      return;
    }

    const response = await bookmarkService.create({
      externalCaseId: item.caseId ? String(item.caseId) : null,
      title: item.title,
      citation: item.citation,
      payload: {
        summary: item.summary,
      },
    });

    setBookmarks((prev) => [response.bookmark, ...prev]);
  };

  const handleOpenBookmark = (bookmark: BookmarkedCase) => {
    setSelectedCase(bookmarkToCaseDigest(bookmark));
  };

  const handleRemoveBookmark = async (bookmark: BookmarkedCase) => {
    await bookmarkService.remove(bookmark.id);
    setBookmarks((prev) => prev.filter((item) => item.id !== bookmark.id));
  };

const handleSuggestionClick = (value: string) => {
  setActiveInput(value.slice(0, MAX_INPUT_LENGTH));
  focusComposer();
};

const handleQuickReply = (value: string) => {
  const prev = activeInput;
  const next = !prev.trim()
    ? value.slice(0, MAX_INPUT_LENGTH)
    : `${prev}\n${value}`.slice(0, MAX_INPUT_LENGTH);

  setActiveInput(next);
  focusComposer();
};

  useEffect(() => {
    draftDocumentIdsRef.current = draftDocumentIdsByConversation;
  }, [draftDocumentIdsByConversation]);

  useEffect(() => {
    draftTitlesRef.current = draftTitlesByConversation;
  }, [draftTitlesByConversation]);

useEffect(() => {
  resizeTextarea();
}, [activeInput]);

  useEffect(() => {
    if (!loading) {
      setLoadingThoughtIndex(0);
      return;
    }

    setLoadingThoughtIndex(0);

    if (streamingThoughts.length <= 1) return;

    const interval = window.setInterval(() => {
      setLoadingThoughtIndex((prev) => (prev + 1) % streamingThoughts.length);
    }, 1700);

    return () => window.clearInterval(interval);
  }, [loading, streamingThoughts]);

  useEffect(() => {
    if (!activeAssistantId) return;
    scrollToActiveAssistantStart("smooth");
  }, [activeAssistantId]);

  useEffect(() => {
    if (!isDraftingMode) {
      setIsDraftDockOpen(false);
    }
  }, [isDraftingMode]);

  useEffect(() => {
    if (!isDraftingMode) return;

    const shouldAutoOpenDock =
      phase === "Generating draft" ||
      draftingAnswerType === "drafting_draft";

    if (shouldAutoOpenDock) {
      setIsDraftDockOpen(true);
    }
  }, [isDraftingMode, phase, draftingAnswerType]);

  useEffect(() => {
    setIsDraftDockOpen(false);
  }, [activeConversationId]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setMessages([makeWorkspaceStarterMessage("chat")]);
      setBookmarks([]);
      setDraftDocumentIdsByConversation({});
      setDraftContentsByConversation({});
      setDraftTitlesByConversation({});
      setDraftAttachmentsByConversation({});
      pendingInitialMessageConversationRef.current = null;
      setIsDraftDockOpen(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setBookmarksLoading(true);

      try {
        const response = await bookmarkService.list();
        if (!cancelled) {
          setBookmarks(response.bookmarks);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          setBookmarksLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      setConversationsLoading(true);

      try {
        const conversationResponse = await conversationService.list(sidebarChatMode);

        if (cancelled) return;

        setConversations(conversationResponse.conversations);

        if (!workspaceView) {
          setMessagesLoading(false);
          return;
        }

        if (!activeConversationId) {
          setMessages([makeWorkspaceStarterMessage(workspaceView)]);
          setMessagesLoading(false);
          return;
        }

        const targetConversationId =
          conversationResponse.conversations.find(
            (item) => item.id === activeConversationId
          )?.id ||
          conversationResponse.conversations[0]?.id ||
          null;

        if (!targetConversationId) {
          if (!cancelled) {
            setMessages([makeWorkspaceStarterMessage(workspaceView)]);
            setMessagesLoading(false);
          }
          return;
        }

        if (activeConversationId !== targetConversationId) {
          navigate(buildConversationPath(workspaceView, targetConversationId), {
            replace: true,
          });
          return;
        }

        if (
          pendingInitialMessageConversationRef.current &&
          pendingInitialMessageConversationRef.current === targetConversationId
        ) {
          setMessagesLoading(false);
          return;
        }

        setMessagesLoading(true);

        try {
          const messageResponse = await conversationService.getMessages(
            targetConversationId
          );

          if (!cancelled) {
            applyMessagesForWorkspace(
              workspaceView,
              targetConversationId,
              mapStoredMessages(messageResponse.messages)
            );
          }
        } finally {
          if (!cancelled) {
            setMessagesLoading(false);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setConversations([]);
          if (workspaceView) {
            setMessages([makeWorkspaceStarterMessage(workspaceView)]);
          }
          setMessagesLoading(false);
        }
      } finally {
        if (!cancelled) {
          setConversationsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, sidebarChatMode, workspaceView, activeConversationId, navigate]);

  useEffect(() => {
    if (!user || !isDraftingMode || !activeConversationId) return;
    if (currentDraftText.trim()) return;

    let cancelled = false;

    (async () => {
      const document = await hydrateDraftDocumentForConversation(activeConversationId);

      if (cancelled || !document) return;

      const nextContent = getDraftContentFromDocument(document);
      if (!nextContent.trim()) return;

      setDraftContentsByConversation((prev) => {
        const existingContent = String(prev[activeConversationId] || "").trim();
        if (existingContent) {
          return prev;
        }

        return {
          ...prev,
          [activeConversationId]: nextContent,
        };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isDraftingMode, activeConversationId, currentDraftText]);

  useEffect(() => {
    if (!user || !isDraftingMode || !activeConversationId) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await draftAttachmentService.list(activeConversationId);

        if (!cancelled) {
          setDraftAttachmentsByConversation((prev) => ({
            ...prev,
            [activeConversationId]: response.attachments || [],
          }));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load drafting uploads", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isDraftingMode, activeConversationId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      resetTypingEngine();
      pendingInitialMessageConversationRef.current = null;

      Object.keys(draftSaveTimersRef.current).forEach((conversationId) => {
        clearDraftSaveTimer(conversationId);
      });
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setDraftingSettings(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setDraftingSettingsLoading(true);

      try {
        const response = await draftingSettingsService.getSettings();

        if (!cancelled) {
          setDraftingSettings(response.settings);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load drafting settings", error);
          setDraftingSettings(null);
        }
      } finally {
        if (!cancelled) {
          setDraftingSettingsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

const stopStreaming = () => {
  abortRef.current?.abort();
  abortRef.current = null;
  pendingInitialMessageConversationRef.current = null;
  setLoading(false);
  setPhase("");

  finalizingAssistantIdRef.current = activeAssistantIdRef.current;

  resetTypingEngine();
  finalizeAssistantMessage("Generation stopped.");
};

  const sendCurrentMessage = async () => {
    if (!canSend || !workspaceView || !currentChatMode) return;

    const query = activeInput.trim().slice(0, MAX_INPUT_LENGTH);
    const controller = new AbortController();
    abortRef.current = controller;

    let conversationId = activeConversationId;

    activeDraftAnswerTypeRef.current = null;
    draftStreamBufferRef.current = "";

    setLoading(true);
    setPhase("Thinking");

    if (!conversationId) {
      const response = await conversationService.create("New chat", currentChatMode);

      const createdConversation: ConversationListItem = {
        id: response.conversation.id,
        title: response.conversation.title,
        chatMode: response.conversation.chatMode,
        createdAt: response.conversation.createdAt,
        updatedAt: response.conversation.updatedAt,
        messageCount: 0,
        preview: "",
        lastMessageRole: null,
        lastMessageAt: response.conversation.updatedAt,
      };

      conversationId = createdConversation.id;
      pendingInitialMessageConversationRef.current = conversationId;
      setConversations((prev) => [createdConversation, ...prev]);

      if (workspaceView === "drafting_document") {
        setDraftContentsByConversation((prev) => ({
          ...prev,
          [conversationId!]: "",
        }));
        setDraftTitlesByConversation((prev) => ({
          ...prev,
          [conversationId!]: createdConversation.title || "Untitled draft",
        }));
        setDraftDocumentIdsByConversation((prev) => ({
          ...prev,
          [conversationId!]: "",
        }));
        setDraftAttachmentsByConversation((prev) => ({
          ...prev,
          [conversationId!]: [],
        }));
      }

      navigate(buildConversationPath(workspaceView, conversationId), {
        replace: true,
      });
    }

    const assistantId = uuid();

    resetTypingEngine();
    if (workspaceView === "drafting_document") {
        setDraftingInput("");
      } else {
        setChatInput("");
      }
    setActiveAssistantId(assistantId);
    activeAssistantIdRef.current = assistantId;

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId && conversation.title === "New chat"
          ? {
              ...conversation,
              title: isDraftingMode
                ? deriveCleanDraftTitle({
                    rawTitle: deriveConversationTitle(query),
                    fallback: query,
                  })
                : deriveConversationTitle(query),
            }
          : conversation
      )
    );

    if (workspaceView === "drafting_document" && conversationId) {
      setDraftTitlesByConversation((prev) => ({
        ...prev,
        [conversationId!]: deriveCleanDraftTitle({
          rawTitle: deriveConversationTitle(query),
          fallback: query,
        }),
      }));
    }

    setMessages((prev) => {
      const starterContent = makeWorkspaceStarterMessage(workspaceView).content;
      const base =
        prev.length === 1 &&
        prev[0].role === "assistant" &&
        prev[0].content === starterContent
          ? []
          : prev;

      return [
        ...base,
        {
          id: uuid(),
          role: "user",
          content: query,
          sources: [],
          caseDigests: [],
          trace: null,
        },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          streaming: true,
          sources: [],
          caseDigests: [],
          trace: null,
        },
      ];
    });

    const currentAttachmentIds =
      (conversationId &&
        (draftAttachmentsByConversation[conversationId] || []).map((item) => item.id)) ||
      [];

    try {
      await streamChat(
        {
          conversationId,
          query,
          chatMode: currentChatMode,
          saveDraftDocument: isDraftingMode,
          documentTitle:
          isDraftingMode
            ? undefined
            : deriveConversationTitle(query),
          attachmentIds: currentAttachmentIds,
          draftDocumentId:
            isDraftingMode && currentDraftDocumentId
              ? currentDraftDocumentId
              : undefined,
          currentDraftText:
            isDraftingMode && currentDraftText.trim()
              ? currentDraftText
              : undefined,
          currentDraftTitle:
            isDraftingMode && currentDraftTitle.trim()
              ? currentDraftTitle
              : undefined,
          selectedCourtIds:
            !isDraftingMode && selectedCourtIds.length > 0
              ? selectedCourtIds
              : undefined,
        },
        (event) => {
          const streamedConversationId = event.conversationId || conversationId;

          if (event.type === "status") {
            setPhase(event.phase || "Thinking");
            if (event.trace) {
              attachAssistantMeta({ trace: event.trace });
            }
            return;
          }

          if (event.type === "meta") {
            attachAssistantMeta({
              sources: event.sources || [],
              caseDigests: event.caseDigests || [],
              trace: event.trace || null,
            });
            return;
          }

          if ((event as any).type === "preview") {
            const preview = String((event as any).preview || "").trim();

            if (preview && isDraftingMode && streamedConversationId) {
              const nextTitle = deriveCleanDraftTitle({
                rawTitle: preview,
                fallback: query,
              });

              setDraftTitlesByConversation((prev) => ({
                ...prev,
                [streamedConversationId]: nextTitle,
              }));

              setConversations((prev) =>
                prev.map((item) =>
                  item.id === streamedConversationId
                    ? { ...item, title: nextTitle }
                    : item
                )
              );
            }

            return;
          }

          if ((event as any).type === "credits") {
            // update auth context so header shows live credits
            const credits = (event as any).creditsRemaining;
            if (typeof credits === "number") {
              setCreditsRemaining(credits);
            }
            return;
          }

          if (event.type === "delta") {
            const answerType = activeDraftAnswerTypeRef.current;

            if (isDraftingMode && answerType === "drafting_draft") {
              draftStreamBufferRef.current += event.text;
              setPhase("Generating draft");

              if (streamedConversationId) {
                setDraftContentsByConversation((prev) => ({
                  ...prev,
                  [streamedConversationId]: draftStreamBufferRef.current,
                }));
              }

              return;
            }

            setPhase("Streaming answer");
            enqueueAssistantDelta(event.text);
            return;
          }

          if (event.type === "done") {
            setLoading(false);
            setPhase("");
            abortRef.current = null;
            pendingInitialMessageConversationRef.current = null;

            finalizingAssistantIdRef.current = activeAssistantIdRef.current;

            const answerType = activeDraftAnswerTypeRef.current;

            if (isDraftingMode && answerType === "drafting_draft") {
              const fullDraft = draftStreamBufferRef.current.trim();

              if (fullDraft && streamedConversationId) {
                const nextTitle = deriveCleanDraftTitle({
                  rawTitle: draftTitlesRef.current[streamedConversationId] || query,
                  draftText: fullDraft,
                  fallback: query,
                });

                setDraftContentsByConversation((prev) => ({
                  ...prev,
                  [streamedConversationId]: fullDraft,
                }));
                setDraftTitlesByConversation((prev) => ({
                  ...prev,
                  [streamedConversationId]: nextTitle,
                }));
                setConversations((prev) =>
                  prev.map((item) =>
                    item.id === streamedConversationId
                      ? { ...item, title: nextTitle }
                      : item
                  )
                );
              }

              if (event.draftDocumentId && streamedConversationId) {
                setDraftDocumentIdsByConversation((prev) => ({
                  ...prev,
                  [streamedConversationId]: event.draftDocumentId!,
                }));

                if (!fullDraft) {
                  void hydrateDraftDocumentForConversation(
                    streamedConversationId,
                    event.draftDocumentId
                  );
                }
              }

              updateAssistantMessage((last) => ({
                ...last,
                id: event.assistantMessageId || last.id,
                content: makeDraftingChatSummary(last.trace, fullDraft),
                streaming: false,
              }));

              clearAssistantTracking();
              draftStreamBufferRef.current = "";
              activeDraftAnswerTypeRef.current = null;
              void loadConversations(currentChatMode);
              return;
            }

            if (
              typingQueueRef.current.length === 0 &&
              typingTimerRef.current === null
            ) {
              finalizeAssistantMessage(undefined, event.assistantMessageId);
            } else {
              finalizePendingRef.current = {
                pending: true,
                fallback: undefined,
                assistantMessageId: event.assistantMessageId,
              };
            }

            if (event.draftDocumentId && streamedConversationId) {
              setDraftDocumentIdsByConversation((prev) => ({
                ...prev,
                [streamedConversationId]: event.draftDocumentId!,
              }));

              void hydrateDraftDocumentForConversation(
                streamedConversationId,
                event.draftDocumentId
              );
            }

            activeDraftAnswerTypeRef.current = null;
            draftStreamBufferRef.current = "";
            void loadConversations(currentChatMode);
            return;
          }

          if (event.type === "error") {
            setLoading(false);
            setPhase("");
            abortRef.current = null;
            resetTypingEngine();
            pendingInitialMessageConversationRef.current = null;
            activeDraftAnswerTypeRef.current = null;
            draftStreamBufferRef.current = "";

            finalizingAssistantIdRef.current = activeAssistantIdRef.current;

            updateAssistantMessage((last) => ({
              ...last,
              content: event.message || "Something went wrong.",
              streaming: false,
            }));

            clearAssistantTracking();
          }
        },
        { signal: controller.signal }
      );
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        return;
      }

      console.error(error);
      setLoading(false);
      setPhase("");
      abortRef.current = null;
      resetTypingEngine();
      pendingInitialMessageConversationRef.current = null;
      activeDraftAnswerTypeRef.current = null;
      draftStreamBufferRef.current = "";

      finalizingAssistantIdRef.current = activeAssistantIdRef.current;

      updateAssistantMessage((last) => ({
        ...last,
        content: "Stream failed. Check backend route and API base URL.",
        streaming: false,
      }));

      clearAssistantTracking();
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendCurrentMessage();
  };

  const onComposerKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendCurrentMessage();
    }
  };

  const remainingChars = MAX_INPUT_LENGTH - activeInput.length;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <>
        <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col">
          <TopNavigation
            userName={user.name || user.email}
            onLogout={logout}
            currentSection="ai"
            logoSrc="/logo.png"
            cfBaseUrl={import.meta.env.VITE_CF_BASE_URL}
            aiBaseUrl={import.meta.env.VITE_AI_BASE_URL}
          />
        <div className="mx-auto flex min-h-0 flex-1 w-full overflow-hidden">
          <Sidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            loading={conversationsLoading}
            activeView={activeView}
            onChangeView={(view) => navigate(buildViewPath(view))}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewConversation}
            userName={user.name || user.email}
            onLogout={logout}
            autoCollapse={isDraftingMode}
            onDeleteConversation={handleDeleteConversation}
          />


        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {activeView === "bookmarks" && (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <BookmarksPage
                    bookmarks={bookmarks}
                    loading={bookmarksLoading}
                    onOpenBookmark={handleOpenBookmark}
                    onRemoveBookmark={handleRemoveBookmark}
                  />
                </div>
              )}

              {activeView === "settings" && (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <SettingsPage
                    initialSettings={draftingSettings}
                    loading={draftingSettingsLoading}
                    onSettingsSaved={setDraftingSettings}
                  />
                </div>
              )}

              {activeView === "credits" && (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <CreditsPage
                    userName={user.name}
                    userEmail={user.email}
                    creditsRemaining={creditsRemaining}
                    onCreditsUpdated={setCreditsRemaining}
                  />
                </div>
              )}

              {workspaceView === "chat" && (
                <WorkspacePane
                  messages={messages}
                  messagesLoading={messagesLoading}
                  hasUserMessages={hasUserMessages}
                  userName={user.name || user.email}
                  greetingTitle={greetingTitle}
                  suggestions={modeSuggestions}
                  isDraftingMode={false}
                  activeAssistantId={activeAssistantId}
                  activeAssistantRef={activeAssistantRef}
                  activeLoadingThought={activeLoadingThought}
                  isCaseBookmarked={(item) =>
                    bookmarkIndex.has(getCaseKeyFromDigest(item))
                  }
                  onCaseOpen={handleCaseOpen}
                  onCaseSummarize={handleCaseSummarize}
                  onToggleBookmark={handleToggleBookmark}
                  onPdfClick={handlePdfClick}
                  onSuggestionClick={handleSuggestionClick}
                  onQuickReply={handleQuickReply}
                  textareaRef={textareaRef}
                  input={chatInput}
                  placeholder={composerPlaceholder}
                  maxInputLength={MAX_INPUT_LENGTH}
                  remainingChars={remainingChars}
                  canSend={canSend}
                  loading={loading}
                  onInputChange={setChatInput}
                  onSubmit={onSubmit}
                  onComposerKeyDown={onComposerKeyDown}
                  onStop={stopStreaming}
                  availableCourts={availableCourts}
                  selectedCourtIds={selectedCourtIds}
                  onSelectedCourtIdsChange={setSelectedCourtIds}
                />
              )}

              {workspaceView === "drafting_document" && (
                <div className="relative flex min-h-0 flex-1 overflow-hidden bg-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      if (!canToggleDraftDock) return;
                      setIsDraftDockOpen((prev) => !prev);
                    }}
                    disabled={!canToggleDraftDock}
                    className={`cursor-pointer absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                      canToggleDraftDock
                        ? "border-[#cfc4ff] bg-white text-[#0b3a6f] shadow-sm hover:bg-[#f5f2ff]"
                        : "border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed"
                    }`}
                    title={isDraftDockOpen ? "Hide draft" : "Open draft"}
                    aria-label={isDraftDockOpen ? "Hide draft" : "Open draft"}
                  >
                    <DraftToggleIcon />
                    {!isDraftDockOpen && hasDraftAvailable ? (
                      <span className="absolute z-0 right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#7b61ff]" />
                    ) : null}
                  </button>

                  <div
                    className={`min-h-0 transition-all duration-300 ease-out ${
                      isDraftDockOpen
                        ? "w-full lg:w-[35%] border-r border-slate-200"
                        : "w-full"
                    }`}
                  >
                    <WorkspacePane
                      compactMode={isDraftDockOpen}
                      messages={messages}
                      messagesLoading={messagesLoading}
                      hasUserMessages={hasUserMessages}
                      userName={user.name || user.email}
                      greetingTitle={greetingTitle}
                      suggestions={modeSuggestions}
                      isDraftingMode
                      activeAssistantId={activeAssistantId}
                      activeAssistantRef={activeAssistantRef}
                      activeLoadingThought={activeLoadingThought}
                      isCaseBookmarked={(item) =>
                        bookmarkIndex.has(getCaseKeyFromDigest(item))
                      }
                      onCaseOpen={handleCaseOpen}
                      onCaseSummarize={handleCaseSummarize}
                      onToggleBookmark={handleToggleBookmark}
                      onPdfClick={handlePdfClick}
                      onSuggestionClick={handleSuggestionClick}
                      onQuickReply={handleQuickReply}
                      textareaRef={textareaRef}
                      input={draftingInput}
                      placeholder={composerPlaceholder}
                      maxInputLength={MAX_INPUT_LENGTH}
                      remainingChars={remainingChars}
                      canSend={canSend && !draftingSpeech.isRecording && !draftingSpeech.isTranscribing}
                      loading={loading}
                      onInputChange={setDraftingInput}
                      onSubmit={onSubmit}
                      onComposerKeyDown={onComposerKeyDown}
                      onStop={stopStreaming}
                      draftAttachments={currentDraftAttachments}
                      uploadingDraftAttachment={uploadingDraftAttachment}
                      onDraftFilePick={handleDraftFileUpload}
                      onRemoveDraftAttachment={handleRemoveDraftAttachment}
                      speechSupported={draftingSpeech.isSupported}
                      speechRecording={draftingSpeech.isRecording}
                      speechTranscribing={draftingSpeech.isTranscribing}
                      speechInterimText={draftingSpeech.interimTranscript}
                      speechError={draftingSpeech.error}
                      onToggleSpeech={draftingSpeech.toggle}
                    />
                  </div>

                  <div
                    className={`min-h-0 overflow-hidden border-l border-[#e4ddff] bg-[#f6f4fb] transition-all duration-300 ease-out ${
                      isDraftDockOpen
                        ? "w-0 opacity-0 lg:w-[65%] lg:opacity-100 z-10 relative"
                        : "w-0 opacity-0"
                    }`}
                  >
                    {shouldRenderDraftDock ? (
                      <DraftingDock
                        key={currentDraftDocumentId || activeConversationId || "drafting-live"}
                        conversationTitle={dockConversationTitle}
                        draftText={currentDraftText}
                        draftDocumentId={currentDraftDocumentId}
                        draftingAnswerType={draftingAnswerType}
                        draftingObjective={draftingObjective}
                        draftingSources={draftingSources}
                        draftingMissingFields={draftingMissingFields}
                        draftingExtractedFacts={draftingExtractedFacts}
                        draftPlaceholderValues={draftingPlaceholderValues}
                        onClose={() => setIsDraftDockOpen(false)}
                        onDraftChange={(html) => {
                          if (!activeConversationId) return;

                          const nextTitle = deriveCleanDraftTitle({
                            rawTitle: currentDraftTitle || dockConversationTitle,
                            draftText: html,
                            fallback: draftingObjective || dockConversationTitle,
                          });

                          setDraftContentsByConversation((prev) => ({
                            ...prev,
                            [activeConversationId]: html,
                          }));
                          setDraftTitlesByConversation((prev) => ({
                            ...prev,
                            [activeConversationId]: nextTitle,
                          }));
                          setConversations((prev) =>
                            prev.map((item) =>
                              item.id === activeConversationId
                                ? { ...item, title: nextTitle }
                                : item
                            )
                          );

                          scheduleDraftPersist(activeConversationId, html, nextTitle);
                        }}
                        branding={brandingForDock}
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <CaseModal
        open={Boolean(selectedCase)}
        caseItem={selectedCase}
        initialTab={caseModalTab}
        onClose={() => {
          setSelectedCase(null);
          setCaseModalTab("case");
        }}
      />
      {creditsLocked && activeView !== "credits" ? (
        <CreditsLockedOverlay
          onBuyCredits={() => navigate(buildViewPath("credits"))}
          onLogout={logout}
        />
      ) : null}
    </>
  );
}
