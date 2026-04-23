import type { MouseEvent, ReactNode } from "react";
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

function BookmarkIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function LikeIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
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

    if (!assistantMessageId) {
      setFeedbackLoaded(true);
      return;
    }

    caseFeedbackService
      .get(String(item.caseId), assistantMessageId)
      .then((response) => {
        if (cancelled) return;
        setLocalFeedback(response.feedback?.feedback ?? null);
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

  const handleFeedback = async (
    event: MouseEvent<HTMLButtonElement>,
    nextValue: "up" | "down"
  ) => {
    event.stopPropagation();

    if (!assistantMessageId || loadingFeedback) {
      return;
    }

    const previous = localFeedback;
    const toggledValue = localFeedback === nextValue ? null : nextValue;

    setLocalFeedback(toggledValue);
    setLoadingFeedback(true);

    try {
      const response = await caseFeedbackService.toggleReaction({
        caseId: String(item.caseId),
        assistantMessageId,
        userMessageId: userMessageId ?? null,
        nextReaction: nextValue,
        fingerprint: null,
      });

      setLocalFeedback(response.feedback?.feedback ?? null);
    } catch {
      setLocalFeedback(previous);
    } finally {
      setLoadingFeedback(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="block w-full p-4 text-left transition cursor-pointer hover:bg-white rounded-[18px]"
    >
      <div className="text-sm font-semibold leading-6 text-slate-900">
        {index + 1}. {item.title}
      </div>

      <div className="mt-1 text-xs text-slate-600">{item.citation}</div>

      <div className="mt-3 text-sm leading-6 text-slate-700">{displaySummary}</div>

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
          label={bookmarked ? "Saved" : "Bookmark"}
          active={bookmarked}
          onClick={(event) => {
            event.stopPropagation();
            onToggleBookmark(item);
          }}
        >
          <BookmarkIcon filled={bookmarked} />
        </TextActionButton>

        <div className="ml-auto flex items-center gap-2">
          <IconToggleButton
            label={localFeedback === "up" ? "Liked" : "Like"}
            active={localFeedback === "up"}
            disabled={!assistantMessageId || loadingFeedback || !feedbackLoaded}
            onClick={(event) => handleFeedback(event, "up")}
          >
            <LikeIcon filled={localFeedback === "up"} />
          </IconToggleButton>

          <IconToggleButton
            label={localFeedback === "down" ? "Disliked" : "Dislike"}
            active={localFeedback === "down"}
            disabled={!assistantMessageId || loadingFeedback || !feedbackLoaded}
            onClick={(event) => handleFeedback(event, "down")}
          >
            <DislikeIcon filled={localFeedback === "down"} />
          </IconToggleButton>
        </div>
      </div>
    </button>
  );
}

