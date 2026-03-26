import type { ConversationListItem } from "../services/conversationService";

type SidebarView = "chat" | "bookmarks" | "settings";

type SidebarProps = {
  conversations: ConversationListItem[];
  activeConversationId: string | null;
  loading: boolean;
  activeView: SidebarView;
  onChangeView: (view: SidebarView) => void;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
}

function ChatIcon() {
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

function BookmarkIcon() {
  return (
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

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="m5.64 5.64 2.12 2.12" />
      <path d="m16.24 16.24 2.12 2.12" />
      <path d="m5.64 18.36 2.12-2.12" />
      <path d="m16.24 7.76 2.12-2.12" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function SidebarNavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-start gap-3 rounded-2xl px-2 py-2 text-sm font-medium transition ${
        active
          ? "bg-blue-50 text-blue-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-xl ${
          active ? "bg-white text-blue-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({
  conversations,
  activeConversationId,
  loading,
  activeView,
  onChangeView,
  onSelectConversation,
  onNewChat,
}: SidebarProps) {
  return (
    <aside className="hidden border-r border-slate-200 bg-[#fcfcfd] lg:flex lg:w-[270px] lg:shrink-0 lg:flex-col">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              Lawsuit AI
            </div>
            <div className="truncate text-xs text-slate-500">
              Legal research, case summaries, and judgment analysis
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onChangeView("chat");
            onNewChat();
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <PlusIcon />
          <span>New chat</span>
        </button>
      </div>

      <div className="border-b border-slate-200 px-3 py-3">
        <div className="space-y-1">
          <SidebarNavButton
            active={activeView === "chat"}
            icon={<ChatIcon />}
            label="Chats"
            onClick={() => onChangeView("chat")}
          />

          <SidebarNavButton
            active={activeView === "bookmarks"}
            icon={<BookmarkIcon />}
            label="Bookmarks"
            onClick={() => onChangeView("bookmarks")}
          />

          <SidebarNavButton
            active={activeView === "settings"}
            icon={<SettingsIcon />}
            label="Settings"
            onClick={() => onChangeView("settings")}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 flex items-center justify-between px-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Recent chats
          </div>

          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <SearchIcon />
          </div>
        </div>

        <div className="space-y-1">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Loading chats...
            </div>
          ) : conversations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm leading-6 text-slate-500">
              No conversations yet.
            </div>
          ) : (
            conversations.map((item) => {
              const active =
                activeView === "chat" && item.id === activeConversationId;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChangeView("chat");
                    onSelectConversation(item.id);
                  }}
                  className={`w-full rounded-2xl px-3 py-3 text-left transition ${
                    active
                      ? "bg-blue-50"
                      : "hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className={`truncate text-sm font-medium ${
                          active ? "text-blue-800" : "text-slate-800"
                        }`}
                      >
                        {item.title}
                      </div>

                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {item.preview || "No messages yet"}
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5 text-[11px] text-slate-400">
                      {formatDate(item.lastMessageAt)}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}