type WorkspaceHeaderProps = {
  activeView: "chat" | "drafting_document" | "bookmarks" | "settings";
  isDraftingMode: boolean;
  activeConversationTitle: string;
  onShare: () => void;
  onUpgrade: () => void;
  onLogout: () => void;
};

export default function WorkspaceHeader({
  activeView,
  isDraftingMode,
  activeConversationTitle,
  onShare,
  onUpgrade,
  onLogout,
}: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase text-slate-500">
            {activeView === "bookmarks"
              ? "Saved cases"
              : activeView === "settings"
              ? "Settings"
              : isDraftingMode
              ? "Drafting studio"
              : "Judgement mode"}
          </div>

          <div className="truncate text-[15px] font-semibold text-slate-900 sm:text-[16px]">
            {activeView === "bookmarks"
              ? "Bookmarks"
              : activeView === "settings"
              ? "Settings"
              : activeConversationTitle}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#114C8D] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#0B3A6E]"
          >
            Upgrade
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}