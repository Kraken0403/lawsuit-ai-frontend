import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  caseFeedbackService,
  type CaseFeedbackReaction,
} from "../services/caseFeedbackService";
import type { CaseDigest } from "../streamChat";

type CaseDigestCardProps = {
  item: CaseDigest;
  index: number;
  bookmarked: boolean;
  onOpen: (item: CaseDigest) => void;
  onSummarize: (item: CaseDigest) => void;
  onToggleBookmark: (item: CaseDigest) => void;
  onPdfClick?: (item: CaseDigest) => void;
  assistantMessageId?: string | null;
  userMessageId?: string | null;
  assistantAnswer?: string | null;
};

function normalizeComparableText(value: unknown) {
  return String(value ?? "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function shouldHideDuplicateSummary(
  digestSummary: unknown,
  assistantAnswer: unknown
) {
  const digest = normalizeComparableText(digestSummary);
  const answer = normalizeComparableText(assistantAnswer);

  if (!digest || !answer) return false;
  if (digest === answer) return true;
  if (digest.length > 80 && answer.includes(digest)) return true;
  if (answer.length > 80 && digest.includes(answer)) return true;

  return false;
}

function isInteractiveEventTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      'button, a, input, textarea, select, [contenteditable="true"], [role="textbox"]'
    )
  );
}

function SummaryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 6h16" />
      <path d="M4 12h10" />
      <path d="M4 18h8" />
    </svg>
  );
}

function BriefcaseIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M9 3h6a2 2 0 0 1 2 2v2h3a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2h3V5a2 2 0 0 1 2-2Zm6 4V5H9v2h6Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
      <path d="M3 10h18" />
      <path d="M5 6h14a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a2 2 0 0 1 2-2Z" />
      <path d="M12 10v2" />
    </svg>
  );
}

function LikeIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M2 10h4v11H2V10Zm6 11h8.6a3 3 0 0 0 2.92-2.32l1.38-6A3 3 0 0 0 17.98 9H14V5a2 2 0 0 0-3.6-1.2L7.5 7.67A3 3 0 0 0 7 9.47V20a1 1 0 0 0 1 1Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 10v11" />
      <path d="M2 10h5v11H2z" />
      <path d="M7 10 11.4 4.2A2 2 0 0 1 15 5.4V9h3a3 3 0 0 1 2.92 3.68l-1.38 6A3 3 0 0 1 16.62 21H7" />
    </svg>
  );
}

function DislikeIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M19 14H6.83l1.58 4.74c.39 1.17-.48 2.26-1.69 2.26-.66 0-1.27-.34-1.62-.9L2 14.5V4a2 2 0 0 1 2-2h11c.85 0 1.6.54 1.87 1.34L19 10v4z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 14H6.83l1.58 4.74c.39 1.17-.48 2.26-1.69 2.26-.66 0-1.27-.34-1.62-.9L2 14.5V4a2 2 0 0 1 2-2h11c.85 0 1.6.54 1.87 1.34L19 10v4z" />
    </svg>
  );
}

function CommentIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M5 3h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H9.4l-4.7 3.53A1 1 0 0 1 3 20.73V6a3 3 0 0 1 2-3Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z" />
    </svg>
  );
}

function TextActionButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-white text-slate-400"
          : active
          ? "cursor-pointer border-[#114C8D] bg-[#114C8D] text-white"
          : "cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function IconToggleButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition cursor-pointer ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-white text-slate-400"
          : active
          ? "border-[#114C8D] bg-[#114C8D] text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function CaseDigestCard({
  item,
  index,
  bookmarked,
  onOpen,
  onSummarize,
  onToggleBookmark,
  assistantMessageId,
  userMessageId,
  assistantAnswer,
}: CaseDigestCardProps) {
  const [localFeedback, setLocalFeedback] =
    useState<CaseFeedbackReaction>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [commentBoxOpen, setCommentBoxOpen] = useState(false);
  const [commentSaved, setCommentSaved] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackLoaded, setFeedbackLoaded] = useState(false);

  const displaySummary = useMemo(() => {
    if (shouldHideDuplicateSummary(item.summary, assistantAnswer)) {
      return "Click to open the case in detail";
    }

    return item.summary || "Click to open the case in detail";
  }, [item.summary, assistantAnswer]);

  useEffect(() => {
    let cancelled = false;

    setFeedbackLoaded(false);
    setLocalFeedback(null);
    setFeedbackComment("");
    setCommentBoxOpen(false);
    setCommentSaved(false);
    setCommentError("");

    if (!assistantMessageId) {
      setFeedbackLoaded(true);
      return;
    }

    caseFeedbackService
      .get(String(item.caseId), assistantMessageId)
      .then((response) => {
        if (cancelled) return;

        const savedFeedback = response.feedback?.feedback ?? null;
        const savedComment = response.feedback?.comment ?? "";

        setLocalFeedback(savedFeedback);
        setFeedbackComment(savedComment);
        setCommentBoxOpen(savedFeedback === "down" && !savedComment.trim());
        setFeedbackLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFeedbackLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [item.caseId, assistantMessageId]);

  const saveFeedback = async (
    nextReaction: CaseFeedbackReaction,
    comment: string | null
  ) => {
    if (!assistantMessageId) return;

    const response = await caseFeedbackService.save({
      caseId: String(item.caseId),
      assistantMessageId,
      userMessageId: userMessageId ?? null,
      feedback: nextReaction,
      comment,
      fingerprint: null,
    });

    setLocalFeedback(response.feedback?.feedback ?? null);
    setFeedbackComment(response.feedback?.comment ?? "");
  };

  const handleLike = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!assistantMessageId || loadingFeedback) return;

    const previousReaction = localFeedback;
    const previousComment = feedbackComment;
    const nextReaction = localFeedback === "up" ? null : "up";

    setLocalFeedback(nextReaction);
    setCommentBoxOpen(false);
    setCommentSaved(false);
    setCommentError("");
    setLoadingFeedback(true);

    try {
      await saveFeedback(nextReaction, feedbackComment.trim() || null);
    } catch {
      setLocalFeedback(previousReaction);
      setFeedbackComment(previousComment);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleToggleCommentBox = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!assistantMessageId || loadingFeedback) return;

    setCommentBoxOpen((prev) => !prev);
    setCommentSaved(false);
    setCommentError("");
  };

  const handleDislike = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!assistantMessageId || loadingFeedback) return;

    const previousReaction = localFeedback;
    const previousComment = feedbackComment;

    setLocalFeedback("down");
    setCommentBoxOpen(true);
    setCommentSaved(false);
    setCommentError("");
    setLoadingFeedback(true);

    try {
      await saveFeedback("down", feedbackComment || null);
    } catch {
      setLocalFeedback(previousReaction);
      setFeedbackComment(previousComment);
      setCommentError("Could not save dislike. Please try again.");
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleSaveComment = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!assistantMessageId || loadingFeedback) return;

    const trimmedComment = feedbackComment.trim();

    setCommentSaved(false);
    setCommentError("");
    setLoadingFeedback(true);

    try {
      await saveFeedback(localFeedback, trimmedComment || null);
      setCommentSaved(true);
    } catch {
      setCommentError("Could not save comment. Please try again.");
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleClearComment = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!assistantMessageId || loadingFeedback) return;

    const previousReaction = localFeedback;
    const previousComment = feedbackComment;

    setFeedbackComment("");
    setCommentSaved(false);
    setCommentError("");
    setLoadingFeedback(true);

    try {
      await saveFeedback(localFeedback, null);
    } catch {
      setLocalFeedback(previousReaction);
      setFeedbackComment(previousComment);
      setCommentError("Could not clear comment. Please try again.");
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleClearDislike = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!assistantMessageId || loadingFeedback) return;

    const previousReaction = localFeedback;
    const previousComment = feedbackComment;

    setLocalFeedback(null);
    setFeedbackComment("");
    setCommentBoxOpen(false);
    setCommentSaved(false);
    setCommentError("");
    setLoadingFeedback(true);

    try {
      await saveFeedback(null, null);
    } catch {
      setLocalFeedback(previousReaction);
      setFeedbackComment(previousComment);
      setCommentBoxOpen(previousReaction === "down");
      setCommentError("Could not clear dislike. Please try again.");
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isInteractiveEventTarget(event.target)) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(item);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={handleCardKeyDown}
      className="block w-full rounded-[18px] p-4 text-left transition cursor-pointer hover:bg-white"
    >
      <div className="text-sm font-semibold leading-6 text-slate-900">
        {index + 1}. {item.title}
      </div>

      <div className="mt-1 text-xs text-slate-600">{item.citation}</div>

      <div className="mt-3 text-sm leading-6 text-slate-700">
        {displaySummary}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TextActionButton
          label="Summary"
          onClick={(event) => {
            event.stopPropagation();
            onSummarize(item);
          }}
        >
          <SummaryIcon />
        </TextActionButton>

        <TextActionButton
          label={bookmarked ? "Saved to Briefcase" : "Save to Briefcase"}
          active={bookmarked}
          onClick={(event) => {
            event.stopPropagation();
            onToggleBookmark(item);
          }}
        >
          <BriefcaseIcon filled={bookmarked} />
        </TextActionButton>

        <div className="ml-auto flex items-center gap-2">
          <IconToggleButton
            label={localFeedback === "up" ? "Liked" : "Like"}
            active={localFeedback === "up"}
            disabled={!assistantMessageId || loadingFeedback || !feedbackLoaded}
            onClick={handleLike}
          >
            <LikeIcon filled={localFeedback === "up"} />
          </IconToggleButton>

          <IconToggleButton
            label={localFeedback === "down" ? "Edit dislike reason" : "Dislike"}
            active={localFeedback === "down"}
            disabled={!assistantMessageId || loadingFeedback || !feedbackLoaded}
            onClick={handleDislike}
          >
            <DislikeIcon filled={localFeedback === "down"} />
          </IconToggleButton>

          <IconToggleButton
            label={feedbackComment.trim() ? "Edit case comment" : "Comment"}
            active={commentBoxOpen || Boolean(feedbackComment.trim())}
            disabled={!assistantMessageId || loadingFeedback || !feedbackLoaded}
            onClick={handleToggleCommentBox}
          >
            <CommentIcon
              filled={commentBoxOpen || Boolean(feedbackComment.trim())}
            />
          </IconToggleButton>
        </div>
      </div>

      {commentBoxOpen ? (
        <div
          className="mt-4 rounded-2xl border border-slate-200 bg-white p-3"
          onClick={(event) => event.stopPropagation()}
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Comment on this case
          </label>

          <textarea
            value={feedbackComment}
            onChange={(event) => {
              setFeedbackComment(event.target.value);
              setCommentSaved(false);
              setCommentError("");
            }}
            rows={3}
            maxLength={1000}
            placeholder="Add a note about why this case is useful, irrelevant, or needs follow-up..."
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#114C8D] focus:ring-2 focus:ring-blue-100"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-500">
              {commentError
                ? commentError
                : commentSaved
                ? "Comment saved."
                : localFeedback === "down"
                ? "This helps improve future case ranking."
                : "This note is saved for this case suggestion."}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCommentBoxOpen(false)}
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>

              {localFeedback === "down" ? (
                <button
                  type="button"
                  onClick={handleClearDislike}
                  disabled={loadingFeedback}
                  className="cursor-pointer rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear dislike
                </button>
              ) : feedbackComment.trim() ? (
                <button
                  type="button"
                  onClick={handleClearComment}
                  disabled={loadingFeedback}
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear comment
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleSaveComment}
                disabled={loadingFeedback}
                className="cursor-pointer rounded-full bg-[#114C8D] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0B3A6E] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loadingFeedback ? "Saving..." : "Save comment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
