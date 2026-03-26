import type { BookmarkedCase } from "../services/bookmarkService";

type BookmarksPageProps = {
  bookmarks: BookmarkedCase[];
  loading: boolean;
  onOpenBookmark: (bookmark: BookmarkedCase) => void;
  onRemoveBookmark: (bookmark: BookmarkedCase) => void | Promise<void>;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function getSummary(bookmark: BookmarkedCase) {
  const payload = bookmark.payloadJson;

  if (
    payload &&
    typeof payload === "object" &&
    "summary" in payload &&
    typeof payload.summary === "string"
  ) {
    return payload.summary;
  }

  return "";
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function BookmarksPage({
  bookmarks,
  loading,
  onOpenBookmark,
  onRemoveBookmark,
}: BookmarksPageProps) {
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
          <BookmarkIcon />
          <span>Saved cases</span>
        </div>

        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Bookmarks
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          View and manage the cases you have bookmarked for later review.
        </p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          Loading bookmarks...
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <BookmarkIcon />
          </div>

          <div className="text-lg font-semibold text-slate-900">
            No bookmarked cases yet
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Bookmark cases from chat results and they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookmarks.map((bookmark) => {
            const summary = getSummary(bookmark);

            return (
              <div
                key={bookmark.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold leading-7 text-slate-900">
                      {bookmark.title}
                    </div>

                    <div className="mt-1 text-sm text-blue-700">
                      {bookmark.citation}
                    </div>

                    {summary ? (
                      <div className="mt-4 text-sm leading-7 text-slate-600">
                        {summary}
                      </div>
                    ) : null}

                    <div className="mt-4 text-xs text-slate-400">
                      Saved on {formatDate(bookmark.createdAt)}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenBookmark(bookmark)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <OpenIcon />
                      <span>Open</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveBookmark(bookmark)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                    >
                      <DeleteIcon />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}