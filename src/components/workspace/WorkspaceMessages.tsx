import { useEffect, useState, type RefObject } from "react";
import type { AppMessage } from "../../lib/appHelpers";
import type { CaseDigest } from "../../streamChat";
import OrbCanvas from "../OrbCanvas";
import Typewriter from "../Typewriter";
import CaseDigestCard from "../CaseDigestCard";
import DraftingQuickReplies from "./DraftingQuickReplies";
import { getDraftingAnswerTypeFromTrace } from "../../lib/workspaceMode";
import {
  assistantFeedbackService,
  type AssistantFeedbackMode,
} from "../../services/assistantFeedbackService";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-transparent">
      <div className="py-3">
        <div className="text-[11px] font-semibold uppercase text-slate-500">
          {title}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function CommentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

type WorkspaceMessagesProps = {
  messages: AppMessage[];
  messagesLoading: boolean;
  hasUserMessages: boolean;
  userName?: string | null;
  greetingTitle: string;
  suggestions: string[];
  isDraftingMode: boolean;
  activeAssistantId: string | null;
  activeAssistantRef: RefObject<HTMLDivElement | null>;
  activeLoadingThought: string;
  isCaseBookmarked: (item: CaseDigest) => boolean;
  onCaseOpen: (item: CaseDigest) => void;
  onCaseSummarize: (item: CaseDigest) => void;
  onToggleBookmark: (item: CaseDigest) => void;
  onPdfClick: (item: CaseDigest) => void;
  onSuggestionClick: (value: string) => void;
  onQuickReply: (value: string) => void;
  compactMode?: boolean;
};

type CommentState = {
  open: boolean;
  draft: string;
  saved: string;
  saving: boolean;
  loaded: boolean;
};

export default function WorkspaceMessages({
  messages,
  messagesLoading,
  hasUserMessages,
  userName,
  greetingTitle,
  suggestions,
  isDraftingMode,
  activeAssistantId,
  activeAssistantRef,
  activeLoadingThought,
  isCaseBookmarked,
  onCaseOpen,
  onCaseSummarize,
  onToggleBookmark,
  onPdfClick,
  onSuggestionClick,
  onQuickReply,
  compactMode = false,
}: WorkspaceMessagesProps) {
  const [commentStateByMessageId, setCommentStateByMessageId] = useState<
    Record<string, CommentState>
  >({});

  const feedbackMode: AssistantFeedbackMode = isDraftingMode
    ? "drafting_mode"
    : "judgment_mode";

  useEffect(() => {
    let cancelled = false;

    const assistantMessages = messages.filter(
      (message) => message.role === "assistant"
    );

    assistantMessages.forEach((message) => {
      const current = commentStateByMessageId[message.id];
      if (current?.loaded) return;

      assistantFeedbackService
        .get(message.id)
        .then((response) => {
          if (cancelled) return;

          setCommentStateByMessageId((prev) => ({
            ...prev,
            [message.id]: {
              open: prev[message.id]?.open ?? false,
              draft:
                prev[message.id]?.draft ??
                response.feedback?.comment ??
                "",
              saved: response.feedback?.comment ?? "",
              saving: false,
              loaded: true,
            },
          }));
        })
        .catch(() => {
          if (cancelled) return;

          setCommentStateByMessageId((prev) => ({
            ...prev,
            [message.id]: {
              open: prev[message.id]?.open ?? false,
              draft: prev[message.id]?.draft ?? "",
              saved: prev[message.id]?.saved ?? "",
              saving: false,
              loaded: true,
            },
          }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [messages, commentStateByMessageId]);

  const toggleCommentBox = (messageId: string) => {
    setCommentStateByMessageId((prev) => ({
      ...prev,
      [messageId]: {
        open: !prev[messageId]?.open,
        draft:
          prev[messageId]?.draft ??
          prev[messageId]?.saved ??
          "",
        saved: prev[messageId]?.saved ?? "",
        saving: prev[messageId]?.saving ?? false,
        loaded: prev[messageId]?.loaded ?? false,
      },
    }));
  };

  const setCommentDraft = (messageId: string, value: string) => {
    setCommentStateByMessageId((prev) => ({
      ...prev,
      [messageId]: {
        open: prev[messageId]?.open ?? true,
        draft: value,
        saved: prev[messageId]?.saved ?? "",
        saving: prev[messageId]?.saving ?? false,
        loaded: prev[messageId]?.loaded ?? true,
      },
    }));
  };

  const closeCommentBox = (messageId: string) => {
    setCommentStateByMessageId((prev) => ({
      ...prev,
      [messageId]: {
        open: false,
        draft: prev[messageId]?.draft ?? prev[messageId]?.saved ?? "",
        saved: prev[messageId]?.saved ?? "",
        saving: prev[messageId]?.saving ?? false,
        loaded: prev[messageId]?.loaded ?? true,
      },
    }));
  };

  const saveComment = async (
    messageId: string,
    userMessageId?: string | null
  ) => {
    const value = (commentStateByMessageId[messageId]?.draft || "").trim();

    setCommentStateByMessageId((prev) => ({
      ...prev,
      [messageId]: {
        open: prev[messageId]?.open ?? true,
        draft: prev[messageId]?.draft ?? "",
        saved: prev[messageId]?.saved ?? "",
        saving: true,
        loaded: prev[messageId]?.loaded ?? true,
      },
    }));

    try {
      const response = await assistantFeedbackService.saveComment({
        mode: feedbackMode,
        assistantMessageId: messageId,
        userMessageId: userMessageId ?? null,
        comment: value,
      });

      setCommentStateByMessageId((prev) => ({
        ...prev,
        [messageId]: {
          open: false,
          draft: response.feedback?.comment ?? "",
          saved: response.feedback?.comment ?? "",
          saving: false,
          loaded: true,
        },
      }));
    } catch {
      setCommentStateByMessageId((prev) => ({
        ...prev,
        [messageId]: {
          open: prev[messageId]?.open ?? true,
          draft: prev[messageId]?.draft ?? "",
          saved: prev[messageId]?.saved ?? "",
          saving: false,
          loaded: true,
        },
      }));
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div
        className={`mx-auto w-full ${
          compactMode ? "max-w-[560px] px-5 py-5" : "max-w-[800px] px-4 py-6"
        }`}
      >
        <div className={compactMode ? "rounded-[24px] p-4" : "rounded-[28px] p-8"}>
          {!hasUserMessages && !messagesLoading && (
            <div className="mb-8">
              <div className="flex flex-col items-center gap-6 text-center">
                {!compactMode && <OrbCanvas size={160} />}

                <div className="text-center">
                  <div className="text-sm text-slate-500 ">Hello {userName || ""}</div>
                  <div className="mt-3 font-extrabold greeting-title">
                    <Typewriter text={greetingTitle} wordDelay={380} />
                  </div>
                </div>

                <div className="w-full flex justify-center">
                  <div className="mt-4 grid w-full max-w-[760px] grid-cols-1 gap-3 sm:grid-cols-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        className="suggestion-pill text-slate-600"
                        onClick={() => onSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {messagesLoading && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
              Loading conversation...
            </div>
          )}

          {!messagesLoading && (
            <div className="space-y-8">
              {messages.map((message, msgIndex) => {
                const isUser = message.role === "user";
                const draftingAnswerType = getDraftingAnswerTypeFromTrace(message.trace);
                const hasFinishedCases =
                  !isDraftingMode &&
                  !message.streaming &&
                  (message.caseDigests?.length || 0) > 0;

                if (isUser) {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[88%] rounded-[14px] bg-[#114C8D] px-4 py-3 text-white shadow-sm sm:max-w-[75%]">
                        <div className="mb-2 text-[11px] font-semibold uppercase text-blue-100">
                          You
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-7 sm:text-[15px]">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  );
                }

                const possibleUserMessage =
                  msgIndex > 0 ? messages[msgIndex - 1] : null;
                const userMessageId =
                  possibleUserMessage && possibleUserMessage.role === "user"
                    ? possibleUserMessage.id
                    : undefined;

                const commentState = commentStateByMessageId[message.id];
                const commentOpen = !!commentState?.open;
                const savedComment = commentState?.saved || "";
                const commentDraft = commentState?.draft || "";
                const commentSaving = !!commentState?.saving;

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
                    <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">
                      Assistant
                    </div>

                    <div className="bg-transparent py-4">
                      <div className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">
                        {message.content && <>{message.content}</>}

                        {!message.content && message.streaming && (
                          <span
                            key={message.id + "-loading"}
                            className="inline-block text-slate-500 transition-opacity duration-300"
                          >
                            {activeLoadingThought}
                          </span>
                        )}

                        {message.streaming && (
                          <span className="ml-1 inline-block h-5 w-2 animate-pulse rounded-sm bg-[#114C8D] align-middle" />
                        )}
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleCommentBox(message.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                          title="Add comment"
                          aria-label="Add comment"
                        >
                          <CommentIcon />
                        </button>

                        {savedComment ? (
                          <span className="text-xs text-slate-500">
                            Comment saved
                          </span>
                        ) : null}
                      </div>

                      {commentOpen ? (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                          <textarea
                            value={commentDraft}
                            onChange={(event) =>
                              setCommentDraft(message.id, event.target.value)
                            }
                            placeholder="Add your comment about this answer..."
                            className="min-h-[96px] w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none focus:border-[#114C8D]"
                          />

                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void saveComment(message.id, userMessageId)}
                              disabled={commentSaving}
                              className="rounded-lg bg-[#114C8D] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0d3c6f] cursor-pointer disabled:opacity-60"
                            >
                              {commentSaving ? "Saving..." : "Save"}
                            </button>

                            <button
                              type="button"
                              onClick={() => closeCommentBox(message.id)}
                              disabled={commentSaving}
                              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {isDraftingMode && draftingAnswerType === "drafting_questions" && (
                        <DraftingQuickReplies
                          trace={message.trace}
                          onSelect={onQuickReply}
                        />
                      )}

                      {hasFinishedCases ? (
                        <div className="mt-6">
                          <Panel title="Related cases">
                            <div className="space-y-3">
                              {message.caseDigests!.map((item, idx) => {
                                return (
                                  <CaseDigestCard
                                    key={`${message.id}_${item.caseId}_${item.citation}_${idx}`}
                                    item={item}
                                    index={idx}
                                    bookmarked={isCaseBookmarked(item)}
                                    onOpen={onCaseOpen}
                                    onSummarize={onCaseSummarize}
                                    onToggleBookmark={onToggleBookmark}
                                    onPdfClick={onPdfClick}
                                    assistantMessageId={message.id}
                                    userMessageId={userMessageId}
                                    assistantAnswer={message.content}
                                  />
                                );
                              })}
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
    </div>
  );
}

