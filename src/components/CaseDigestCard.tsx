import type { MouseEvent } from "react";
import type { CaseDigest } from "../streamChat";

type CaseDigestCardProps = {
  item: CaseDigest;
  index: number;
  bookmarked: boolean;
  onOpen: (item: CaseDigest) => void;
  onSummarize: (item: CaseDigest) => void;
  onToggleBookmark: (item: CaseDigest) => void;
  onPdfClick?: (item: CaseDigest) => void;
};

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

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M12 18v-6" />
      <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
    </svg>
  );
}

function ActionButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-white text-slate-400"
          : active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      }`}
    >
      {children}
      <span>{label}</span>
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
  onPdfClick,
}: CaseDigestCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="block w-full py-4 text-left transition hover:border-blue-200 cursor-pointer"
    >
      <div className="text-sm font-semibold leading-6 text-slate-900">
        {index + 1}. {item.title}
      </div>

      <div className="mt-1 text-xs text-blue-700">{item.citation}</div>

      <div className="mt-3 text-sm leading-6 text-slate-600">
        {item.summary}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton
          label="Summary"
          onClick={(event) => {
            event.stopPropagation();
            onSummarize(item);
          }}
        >
          <SummaryIcon />
        </ActionButton>

        <ActionButton
          label={bookmarked ? "Saved" : "Bookmark"}
          active={bookmarked}
          onClick={(event) => {
            event.stopPropagation();
            onToggleBookmark(item);
          }}
        >
          <BookmarkIcon filled={bookmarked} />
        </ActionButton>

        <ActionButton
          label="PDF"
          onClick={(event) => {
            event.stopPropagation();
            onPdfClick?.(item);
          }}
        >
          <FileIcon />
        </ActionButton>
      </div>
    </button>
  );
}