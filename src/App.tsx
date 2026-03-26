import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  streamChat,
  type CaseDigest,
  type SourceItem,
  type StreamTrace,
} from "./streamChat";
import Sidebar from "./components/Sidebar";
import CaseModal from "./components/CaseModal";
import CaseDigestCard from "./components/CaseDigestCard";
import AuthScreen from "./components/AuthScreen";
import BookmarksPage from "./components/BookmarksPage";
import { useAuth } from "./context/AuthContext";
import {
  conversationService,
  type ConversationListItem,
} from "./services/conversationService";
import {
  bookmarkService,
  type BookmarkedCase,
} from "./services/bookmarkService";
import {
  buildStreamingThoughts,
  makeStarterMessage,
  deriveConversationTitle,
  getCaseKeyFromDigest,
  mapStoredMessages,
  bookmarkToCaseDigest,
  SUGGESTIONS,
  type AppMessage,
} from "./lib/appHelpers";

type Message = AppMessage;

const MAX_INPUT_LENGTH = 1000;
const TYPING_SPEED_MS = 16;

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-transparent">
      <div className="py-3">
        <div className="text-[11px] font-semibold uppercase   text-slate-500">
          {title}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function uuid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();

  const [activeView, setActiveView] = useState<"chat" | "bookmarks">("chat");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  
  const [messages, setMessages] = useState<Message[]>([makeStarterMessage()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [selectedCase, setSelectedCase] = useState<CaseDigest | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkedCase[]>([]);
  const [loadingThoughtIndex, setLoadingThoughtIndex] = useState(0);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(
    null
  );
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [caseModalTab, setCaseModalTab] = useState<"case" | "summary">("case");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeAssistantRef = useRef<HTMLDivElement | null>(null);

  const typingQueueRef = useRef<string[]>([]);
  const typingTimerRef = useRef<number | null>(null);
  const finalizePendingRef = useRef<{
    pending: boolean;
    fallback?: string;
  }>({ pending: false });

  const canSend = useMemo(
    () =>
      input.trim().length > 0 &&
      input.trim().length <= MAX_INPUT_LENGTH &&
      !loading,
    [input, loading]
  );

  const hasUserMessages = messages.some((message) => message.role === "user");

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ||
      null,
    [conversations, activeConversationId]
  );

  const activeConversationTitle = activeConversation?.title || "New chat";

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

  const bookmarkIndex = useMemo(() => {
    const map = new Map<string, BookmarkedCase>();

    for (const bookmark of bookmarks) {
      map.set(getCaseKeyFromDigest(bookmark), bookmark);
    }

    return map;
  }, [bookmarks]);

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
    finalizePendingRef.current = { pending: false, fallback: undefined };
  };

  const updateLastAssistant = (updater: (message: Message) => Message) => {
    setMessages((prev) => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      if (lastIndex < 0) return prev;

      const last = next[lastIndex];
      if (!last || last.role !== "assistant") return prev;

      next[lastIndex] = updater(last);
      return next;
    });
  };

  const finalizeAssistantMessage = (fallbackText?: string) => {
    updateLastAssistant((last) => {
      const finalContent =
        last.content.trim().length > 0 ? last.content : fallbackText || "";

      return {
        ...last,
        content: finalContent,
        streaming: false,
      };
    });
  };

  const maybeFinalizeAfterTyping = () => {
    if (
      typingQueueRef.current.length === 0 &&
      typingTimerRef.current === null &&
      finalizePendingRef.current.pending
    ) {
      const fallback = finalizePendingRef.current.fallback;
      finalizePendingRef.current = { pending: false, fallback: undefined };
      finalizeAssistantMessage(fallback);
    }
  };

  const appendAssistantCharacter = (char: string) => {
    if (!char) return;

    setMessages((prev) => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      if (lastIndex < 0) return prev;

      const last = next[lastIndex];
      if (!last || last.role !== "assistant") return prev;

      next[lastIndex] = {
        ...last,
        content: last.content + char,
        streaming: true,
      };

      return next;
    });
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

  const attachAssistantMeta = ({
    sources,
    caseDigests,
    trace,
  }: {
    sources?: SourceItem[];
    caseDigests?: CaseDigest[];
    trace?: StreamTrace | null;
  }) => {
    updateLastAssistant((last) => ({
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

  const loadConversations = async () => {
    const response = await conversationService.list();
    setConversations(response.conversations);
    return response.conversations;
  };

  const loadBookmarks = async () => {
    setBookmarksLoading(true);
    try {
      const response = await bookmarkService.list();
      setBookmarks(response.bookmarks);
      return response.bookmarks;
    } finally {
      setBookmarksLoading(false);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    setMessagesLoading(true);

    try {
      const response = await conversationService.getMessages(conversationId);
      setMessages(mapStoredMessages(response.messages));
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    if (loading) return;

    setActiveView("chat");
    setActiveConversationId(conversationId);
    await loadConversationMessages(conversationId);
  };

  const handleNewConversation = async () => {
    const response = await conversationService.create("New chat");

    const newConversation: ConversationListItem = {
      id: response.conversation.id,
      title: response.conversation.title,
      createdAt: response.conversation.createdAt,
      updatedAt: response.conversation.updatedAt,
      messageCount: 0,
      preview: "",
      lastMessageRole: null,
      lastMessageAt: response.conversation.updatedAt,
    };

    setConversations((prev) => [
      newConversation,
      ...prev.filter((item) => item.id !== newConversation.id),
    ]);

    setActiveView("chat");
    setActiveConversationId(newConversation.id);
    setMessages([makeStarterMessage()]);
    setInput("");
    focusComposer();
  };

  const handleShareChat = async () => {
    const url = new URL(window.location.href);

    if (activeView === "chat" && activeConversationId) {
      url.searchParams.set("conversation", activeConversationId);
    } else {
      url.searchParams.delete("conversation");
    }

    try {
      await navigator.clipboard.writeText(url.toString());
    } catch (error) {
      console.error("Failed to copy share link", error);
    }
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

  // const handlePdfClick = (item: CaseDigest) => {
  //   setSelectedCase(item);
  // };

  const handleOpenBookmark = (bookmark: BookmarkedCase) => {
    setSelectedCase(bookmarkToCaseDigest(bookmark));
  };

  const handleRemoveBookmark = async (bookmark: BookmarkedCase) => {
    await bookmarkService.remove(bookmark.id);
    setBookmarks((prev) => prev.filter((item) => item.id !== bookmark.id));
  };

  useEffect(() => {
    resizeTextarea();
  }, [input]);

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
    if (!user) {
      setConversations([]);
      setActiveConversationId(null);
      setMessages([makeStarterMessage()]);
      setBookmarks([]);
      setActiveView("chat");
      return;
    }

    let cancelled = false;

    (async () => {
      setConversationsLoading(true);

      try {
        const [conversationResponse, bookmarksResponse] = await Promise.all([
          conversationService.list(),
          bookmarkService.list(),
        ]);

        if (cancelled) return;

        setConversations(conversationResponse.conversations);
        setBookmarks(bookmarksResponse.bookmarks);

        const urlConversationId = new URL(window.location.href).searchParams.get(
          "conversation"
        );

        const initialConversationId =
          (urlConversationId &&
            conversationResponse.conversations.find(
              (item) => item.id === urlConversationId
            )?.id) ||
          conversationResponse.conversations[0]?.id ||
          null;

        setActiveConversationId(initialConversationId);

        if (initialConversationId) {
          const messageResponse = await conversationService.getMessages(
            initialConversationId
          );

          if (!cancelled) {
            setMessages(mapStoredMessages(messageResponse.messages));
          }
        } else {
          setMessages([makeStarterMessage()]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setMessages([makeStarterMessage()]);
        }
      } finally {
        if (!cancelled) {
          setConversationsLoading(false);
          setBookmarksLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const url = new URL(window.location.href);

    if (activeView === "chat" && activeConversationId) {
      url.searchParams.set("conversation", activeConversationId);
    } else {
      url.searchParams.delete("conversation");
    }

    window.history.replaceState({}, "", url.toString());
  }, [activeConversationId, activeView]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      resetTypingEngine();
    };
  }, []);

  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    resetTypingEngine();
    setLoading(false);
    setPhase("");
    setActiveAssistantId(null);
    finalizeAssistantMessage("Generation stopped.");
  };

  const sendCurrentMessage = async () => {
    if (!canSend) return;

    const query = input.trim().slice(0, MAX_INPUT_LENGTH);
    const controller = new AbortController();
    abortRef.current = controller;

    let conversationId = activeConversationId;

    if (!conversationId) {
      const response = await conversationService.create("New chat");

      const createdConversation: ConversationListItem = {
        id: response.conversation.id,
        title: response.conversation.title,
        createdAt: response.conversation.createdAt,
        updatedAt: response.conversation.updatedAt,
        messageCount: 0,
        preview: "",
        lastMessageRole: null,
        lastMessageAt: response.conversation.updatedAt,
      };

      conversationId = createdConversation.id;
      setConversations((prev) => [createdConversation, ...prev]);
      setActiveConversationId(conversationId);
      setMessages([makeStarterMessage()]);
    }

    const assistantId = uuid();

    resetTypingEngine();
    setInput("");
    setLoading(true);
    setPhase("Thinking");
    setActiveAssistantId(assistantId);
    setActiveView("chat");

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId && conversation.title === "New chat"
          ? {
              ...conversation,
              title: deriveConversationTitle(query),
            }
          : conversation
      )
    );

    setMessages((prev) => {
      const base =
        prev.length === 1 &&
        prev[0].role === "assistant" &&
        prev[0].content === makeStarterMessage().content
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

    try {
      await streamChat(
        { conversationId, query },
        (event) => {
          const streamedConversationId = event.conversationId || conversationId;

          if (
            streamedConversationId &&
            streamedConversationId !== activeConversationId
          ) {
            setActiveConversationId(streamedConversationId);
          }

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

          if (event.type === "delta") {
            setPhase("Streaming answer");
            enqueueAssistantDelta(event.text);
            return;
          }

          if (event.type === "done") {
            setLoading(false);
            setPhase("");
            setActiveAssistantId(null);
            abortRef.current = null;

            if (
              typingQueueRef.current.length === 0 &&
              typingTimerRef.current === null
            ) {
              finalizeAssistantMessage();
            } else {
              finalizePendingRef.current = {
                pending: true,
                fallback: undefined,
              };
            }

            void loadConversations();
            return;
          }

          if (event.type === "error") {
            setLoading(false);
            setPhase("");
            setActiveAssistantId(null);
            abortRef.current = null;
            resetTypingEngine();
            updateLastAssistant((last) => ({
              ...last,
              content: event.message || "Something went wrong.",
              streaming: false,
            }));
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
      setActiveAssistantId(null);
      abortRef.current = null;
      resetTypingEngine();
      updateLastAssistant((last) => ({
        ...last,
        content: "Stream failed. Check backend route and API base URL.",
        streaming: false,
      }));
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

  const remainingChars = MAX_INPUT_LENGTH - input.length;

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
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto min-h-screen max-w-[1600px] lg:flex lg:h-screen">
          <Sidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            loading={conversationsLoading}
            activeView={activeView}
            onChangeView={setActiveView}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewConversation}
          />

          <main className="flex min-w-0 flex-1 flex-col lg:h-screen">
            <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
              <div className="mx-auto flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase   text-slate-500">
                    {activeView === "bookmarks" ? "Saved cases" : "Chat"}
                  </div>
                  <div className="truncate text-[15px] font-semibold text-slate-900 sm:text-[16px]">
                    {activeView === "bookmarks"
                      ? "Bookmarks"
                      : activeConversationTitle}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden text-sm text-slate-500 sm:block">
                    {user.name || user.email}
                  </div>

                  <button
                    type="button"
                    onClick={handleShareChat}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                      <path d="M12 16V3" />
                      <path d="m7 8 5-5 5 5" />
                    </svg>
                    <span>Share</span>
                  </button>

                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
              {activeView === "bookmarks" ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <BookmarksPage
                    bookmarks={bookmarks}
                    loading={bookmarksLoading}
                    onOpenBookmark={handleOpenBookmark}
                    onRemoveBookmark={handleRemoveBookmark}
                  />
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="mx-auto w-full max-w-[768px] px-4 py-6">
                      {!hasUserMessages && !messagesLoading ? (
                        <div className="mb-8">
                          <div className="grid gap-3 sm:grid-cols-2">
                            {SUGGESTIONS.map((suggestion) => (
                              <button
                                key={suggestion}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-slate-900"
                                onClick={() => {
                                  setInput(
                                    suggestion.slice(0, MAX_INPUT_LENGTH)
                                  );
                                  focusComposer();
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {messagesLoading ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                          Loading conversation...
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {messages.map((message) => {
                            const isUser = message.role === "user";
                            const hasFinishedCases =
                              !message.streaming &&
                              (message.caseDigests?.length || 0) > 0;

                            if (isUser) {
                              return (
                                <div key={message.id} className="flex justify-end">
                                  <div className="max-w-[88%] rounded-3xl bg-blue-600 px-4 py-3 text-white shadow-sm sm:max-w-[75%]">
                                    <div className="mb-2 text-[11px] font-semibold uppercase   text-blue-100">
                                      You
                                    </div>
                                    <div className="whitespace-pre-wrap text-sm leading-7 sm:text-[15px]">
                                      {message.content}
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={message.id}
                                ref={
                                  message.id === activeAssistantId
                                    ? activeAssistantRef
                                    : undefined
                                }
                                className="w-full"
                              >
                                <div className="mb-2 text-[11px] font-semibold uppercase   text-slate-500">
                                  Assistant
                                </div>

                                <div className="bg-transparent py-4">
                                  <div className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">
                                    {message.content ? (
                                      message.content
                                    ) : message.streaming ? (
                                      <span
                                        key={activeLoadingThought}
                                        className="inline-block text-slate-500 transition-opacity duration-300"
                                      >
                                        {activeLoadingThought}
                                      </span>
                                    ) : (
                                      ""
                                    )}

                                    {message.streaming ? (
                                      <span className="ml-1 inline-block h-5 w-2 animate-pulse rounded-sm bg-blue-500 align-middle" />
                                    ) : null}
                                  </div>

                                  {hasFinishedCases ? (
                                    <div className="mt-6">
                                      <Panel title="Related cases">
                                        <div className="space-y-3">
                                          {message.caseDigests!.map((item, idx) => (
                                            <CaseDigestCard
                                              key={`${item.caseId}_${item.citation}_${idx}`}
                                              item={item}
                                              index={idx}
                                              bookmarked={bookmarkIndex.has(
                                                getCaseKeyFromDigest(item)
                                              )}
                                              onOpen={handleCaseOpen}
                                              onSummarize={handleCaseSummarize}
                                              onToggleBookmark={handleToggleBookmark}
                                              onPdfClick={handlePdfClick}
                                            />
                                          ))}
                                        </div>
                                      </Panel>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-transparent px-4 py-4 backdrop-blur-xl">
                    <div className="mx-auto w-full max-w-[768px]">
                      <form
                        onSubmit={onSubmit}
                        className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-end gap-3">
                          <textarea
                            ref={textareaRef}
                            className="max-h-[220px] min-h-[52px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                            placeholder="Ask about a case, doctrine, holding, citation, or comparison..."
                            value={input}
                            rows={1}
                            maxLength={MAX_INPUT_LENGTH}
                            onChange={(e) =>
                              setInput(
                                e.target.value.slice(0, MAX_INPUT_LENGTH)
                              )
                            }
                            onKeyDown={onComposerKeyDown}
                          />

                          {loading ? (
                            <button
                              type="button"
                              onClick={stopStreaming}
                              className="inline-flex h-[48px] cursor-pointer w-[48px] items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                              aria-label="Stop generating"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5"
                                fill="currentColor"
                              >
                                <rect x="6" y="6" width="12" height="12" rx="2" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="submit"
                              disabled={!canSend}
                              className="inline-flex h-[48px] cursor-pointer w-[48px] items-center justify-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                              aria-label="Send message"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5"
                                fill="currentColor"
                              >
                                <path d="M3.4 20.4 21.85 12 3.4 3.6v6.55l13.2 1.85-13.2 1.85v6.55Z" />
                              </svg>
                            </button>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between px-3 pb-1 text-xs">
                          <span className="text-slate-500">
                            Enter to send · Shift + Enter for newline
                          </span>

                          <div className="flex items-center gap-3">
                            <span
                              className={
                                remainingChars <= 100
                                  ? "font-medium text-amber-600"
                                  : "text-slate-500"
                              }
                            >
                              {input.length}/{MAX_INPUT_LENGTH}
                            </span>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </>
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
    </>
  );
}