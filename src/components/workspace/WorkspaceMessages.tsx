import type { RefObject } from "react";
import type { AppMessage } from "../../lib/appHelpers";
import type { CaseDigest } from "../../streamChat";
import OrbCanvas from "../OrbCanvas";
import Typewriter from "../Typewriter";
import CaseDigestCard from "../CaseDigestCard";
import DraftingQuickReplies from "./DraftingQuickReplies";
import { getDraftingAnswerTypeFromTrace } from "../../lib/workspaceMode";

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
                {!compactMode && <OrbCanvas size={140} />}

                <div className="text-center">
                  <div className="text-sm text-slate-500">Hello, {userName || ""}</div>
                  <div className="mt-3 font-extrabold greeting-title">
                    <Typewriter text={greetingTitle} wordDelay={380} />
                  </div>
                </div>

                <div className="w-full flex justify-center">
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        className="suggestion-pill"
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
              {messages.map((message) => {
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
                              {message.caseDigests!.map((item, idx) => (
                                <CaseDigestCard
                                  key={`${item.caseId}_${item.citation}_${idx}`}
                                  item={item}
                                  index={idx}
                                  bookmarked={isCaseBookmarked(item)}
                                  onOpen={onCaseOpen}
                                  onSummarize={onCaseSummarize}
                                  onToggleBookmark={onToggleBookmark}
                                  onPdfClick={onPdfClick}
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
    </div>
  );
}