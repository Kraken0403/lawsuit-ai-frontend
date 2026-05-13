import React, { useEffect, useMemo, useState, useRef } from "react";
import { FaCoins } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import type {
  ConversationChatMode,
  ConversationListItem,
} from "../services/conversationService";
import ConfirmDialog from "./ui/ConfirmDialog";

type SidebarView = "chat" | "drafting_document" | "bookmarks" | "settings";

type SidebarProps = {
  conversations: ConversationListItem[];
  activeConversationId: string | null;
  loading: boolean;
  activeView: SidebarView;
  onChangeView: (view: SidebarView) => void;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: (view?: "chat" | "drafting_document") => void;
  userName?: string | null;
  onLogout?: () => void;
  autoCollapse?: boolean;
  onDeleteConversation?: (conversationId: string) => Promise<void> | void;
};

function getConversationView(
  chatMode?: ConversationChatMode
): "chat" | "drafting_document" {
  return chatMode === "drafting_studio" ? "drafting_document" : "chat";
}

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

function DraftingStudioIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="m12 6 4 4" />
    </svg>
  );
}

function TrashIcon() {
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

function BriefcaseIcon() {
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
  collapsed,
  inverted,
  useBlue,
  active,
  icon,
  label,
  onClick,
}: {
  collapsed?: boolean;
  inverted?: boolean;
  useBlue?: boolean;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  if (collapsed) {
    const iconClass = active
      ? "bg-[#0b3a6f] text-white"
      : "bg-transparent text-slate-700";
    const hoverClass = "hover:bg-slate-100";
    const btnBg = active ? "bg-slate-100" : hoverClass;

    return (
      <button
        type="button"
        onClick={onClick}
        title={label}
        className={`w-full rounded-[6px] p-2 transition ${btnBg} cursor-pointer`}
      >
        <div className="flex items-center justify-center">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${iconClass}`}
          >
            {icon}
          </div>
        </div>
      </button>
    );
  }

  let containerClass = "";
  let iconBgClass = "";

  if (useBlue) {
    containerClass = active
      ? "bg-white/10 text-white"
      : "text-white hover:bg-white/5";
    iconBgClass = active
      ? "bg-white text-[#114C8D]"
      : "bg-transparent text-white/90";
  } else {
    containerClass = active
      ? inverted
        ? "bg-white/10 text-white"
        : "bg-blue-50 text-blue-700"
      : inverted
      ? "text-white/90 hover:bg-white/10 hover:text-white"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

    iconBgClass = active
      ? inverted
        ? "bg-white text-[#114C8D]"
        : "bg-white text-blue-700"
      : inverted
      ? "bg-transparent text-white/90"
      : "bg-slate-100 text-slate-500";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-start gap-3 rounded-2xl px-2 py-2 text-sm font-medium transition ${containerClass}`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBgClass}`}
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
  autoCollapse = false,
  onDeleteConversation,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const creditsRemaining = user?.creditsRemaining;
  const [pulse, setPulse] = useState(false);
  const prevCreditsRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prev = prevCreditsRef.current;
    if (typeof prev === "number" && typeof creditsRemaining === "number" && prev !== creditsRemaining) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 900);
      return () => clearTimeout(t);
    }
    prevCreditsRef.current = typeof creditsRemaining === "number" ? creditsRemaining : prev;
  }, [creditsRemaining]);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);

  useEffect(() => {
    if (autoCollapse) {
      setCollapsed(true);
    }
  }, [autoCollapse]);

  const inverted = collapsed;
  const expandedBlue = false;
  const appVersion = import.meta.env.VITE_APP_VERSION || "v1.0.0";

  const sectionTitle =
    activeView === "drafting_document"
      ? "Recent drafting chats"
      : "Recent judgement chats";

  const searchPlaceholder =
    activeView === "drafting_document"
      ? "Search drafting chats..."
      : "Search judgement chats...";

  const emptyText =
    activeView === "drafting_document"
      ? "No drafting conversations yet."
      : "No judgement conversations yet.";

  const loadingText =
    activeView === "drafting_document"
      ? "Loading drafting chats..."
      : "Loading judgement chats...";

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    if (!q) return conversations;

    return conversations.filter(
      (c) =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.preview || "").toLowerCase().includes(q)
    );
  }, [searchQuery, conversations]);

  return (
    <aside
      className={`hidden min-h-0 border-r ${
        inverted ? "border-white/10" : "border-slate-200"
      } bg-white text-slate-900 lg:flex lg:h-full lg:shrink-0 lg:flex-col ${
        collapsed ? "lg:w-[72px]" : "lg:w-[240px]"
      }`}
    >
      

      <div className={`border-b ${inverted ? "border-white/10" : "border-slate-200"} px-3 py-4`}>
        <div className={`flex ${collapsed ? "flex-col-reverse items-center gap-2" : "flex-row items-center gap-2"}`}>
          <button
            type="button"
            onClick={() => {
              const targetView = activeView === "drafting_document" ? "drafting_document" : "chat";
              onChangeView(targetView);
              onNewChat(targetView);
            }}
            title={activeView === "drafting_document" ? "New draft" : "New chat"}
            className={`inline-flex items-center justify-center gap-2 cursor-pointer transition hover:opacity-95 ${collapsed ? "h-10 w-10 rounded-md" : "flex-1 rounded-[6px] px-4 py-3"} ${inverted ? "bg-slate-100 text-slate-700" : "bg-[#114C8D] text-white"}`}
          >
            <PlusIcon />
            {!collapsed && (
              <span>{activeView === "drafting_document" ? "New draft" : "New chat"}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md cursor-pointer ${inverted ? "bg-transparent text-slate-700" : "bg-slate-100 text-slate-600"}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`border-b ${
          inverted ? "border-white/10" : "border-slate-200"
        } px-3 py-3`}
      >
        <div className="space-y-1">
          <SidebarNavButton
            collapsed={collapsed}
            inverted={inverted}
            useBlue={!collapsed && expandedBlue}
            active={activeView === "chat"}
            icon={<ChatIcon />}
            label="Judgement Mode"
            onClick={() => onChangeView("chat")}
          />

          <SidebarNavButton
            collapsed={collapsed}
            inverted={inverted}
            useBlue={!collapsed && expandedBlue}
            active={activeView === "drafting_document"}
            icon={<DraftingStudioIcon />}
            label="Drafting Studio"
            onClick={() => onChangeView("drafting_document")}
          />

          <SidebarNavButton
            collapsed={collapsed}
            inverted={inverted}
            useBlue={!collapsed && expandedBlue}
            active={activeView === "bookmarks"}
            icon={<BriefcaseIcon />}
            label="AI Briefcase"
            onClick={() => onChangeView("bookmarks")}
          />

          <SidebarNavButton
            collapsed={collapsed}
            inverted={inverted}
            useBlue={!collapsed && expandedBlue}
            active={activeView === "settings"}
            icon={<SettingsIcon />}
            label="Settings"
            onClick={() => onChangeView("settings")}
          />
        </div>
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 px-2">
            {!searchActive ? (
              <div className="flex items-center justify-between">
                <div
                  className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    expandedBlue
                      ? "text-white/80"
                      : inverted
                      ? "text-white/80"
                      : "text-slate-500"
                  }`}
                >
                  {sectionTitle}
                </div>
                <button
                  type="button"
                  onClick={() => setSearchActive(true)}
                  className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                    expandedBlue
                      ? "bg-white/5 text-white/80"
                      : inverted
                      ? "bg-slate-100 text-slate-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <SearchIcon />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchActive(false);
                    setSearchQuery("");
                  }}
                  className="text-sm text-slate-500"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            {loading ? (
              <div
                className={`rounded-2xl border ${
                  expandedBlue
                    ? "border-white/10 bg-transparent text-white/80"
                    : inverted
                    ? "border-white/10 bg-white/5 text-white/80"
                    : "border-slate-200 bg-white text-slate-500"
                } p-4 text-sm`}
              >
                {loadingText}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div
                className={`rounded-2xl border ${
                  expandedBlue
                    ? "border-white/10 bg-transparent text-white/80"
                    : inverted
                    ? "border-white/10 bg-white/5 text-white/80"
                    : "border-dashed border-slate-200 bg-white text-slate-500"
                } p-4 text-sm leading-6`}
              >
                {emptyText}
              </div>
            ) : (
              filteredConversations.map((item) => {
                const itemView = getConversationView(item.chatMode);
                const active =
                  item.id === activeConversationId && itemView === activeView;

                const cardClass = active
                  ? expandedBlue
                    ? "bg-white/10"
                    : inverted
                    ? "bg-white/10"
                    : "bg-blue-50"
                  : expandedBlue
                  ? "hover:bg-white/5"
                  : inverted
                  ? "hover:bg-white/5"
                  : "hover:bg-white";

                return (
                  <div
                    key={item.id}
                    className={`group rounded-2xl px-3 py-3 transition ${cardClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onChangeView(itemView);
                          onSelectConversation(item.id);
                        }}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div
                          className={`truncate text-sm font-medium ${
                            expandedBlue
                              ? active
                                ? "text-white"
                                : "text-white/90"
                              : active
                              ? inverted
                                ? "text-white"
                                : "text-blue-800"
                              : inverted
                              ? "text-white"
                              : "text-slate-800"
                          }`}
                        >
                          {item.title}
                        </div>

                        <div
                          className={`mt-1 line-clamp-2 text-xs leading-5 ${
                            expandedBlue
                              ? "text-white/80"
                              : inverted
                              ? "text-white/80"
                              : "text-slate-500"
                          }`}
                        >
                          {item.preview || "No messages yet"}
                        </div>
                      </button>

                      <div className="flex shrink-0 items-start gap-2">
                        <div
                          className={`pt-0.5 text-[11px] ${
                            expandedBlue
                              ? "text-white/70"
                              : inverted
                              ? "text-white/70"
                              : "text-slate-400"
                          }`}
                        >
                          {formatDate(item.lastMessageAt)}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteId(item.id);
                          }}
                          className="cursor-pointer rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                          title="Delete chat"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      
      <div className={`border-t ${inverted ? "border-white/10" : "border-slate-200"} px-3 py-3`}>
        <div className="flex items-center justify-center">
          {collapsed ? (
            <button type="button" title={`Credits: ${typeof creditsRemaining === "number" ? creditsRemaining : "-"}`} className="p-1">
              <FaCoins className="react-coin-icon text-yellow-500" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <FaCoins className="react-coin-icon text-yellow-500" />
              <span className={`credit-pill sidebar-credit-pill ${pulse ? "pulse" : ""}`}>
                {typeof creditsRemaining === "number" ? creditsRemaining : "-"}
              </span>
              <div className="text-xs text-slate-500">Credits Remaining</div>
            </div>
          )}
        </div>
      </div>

      <div
        className={`mt-auto border-t ${
          inverted ? "border-white/10" : "border-slate-200"
        } px-3 py-3`}
      >
        {collapsed ? (
          <div className="flex items-center justify-center">
            <div
              className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                inverted ? "text-slate-500" : "text-slate-400"
              }`}
              title={`Lawsuit AI ${appVersion}`}
            >
              {appVersion}
            </div>
          </div>
        ) : (
          <div className="space-y-1 text-center">
            <div className="text-xs font-semibold text-slate-600">
              Lawsuit AI {appVersion}
              
            </div>

            <div className="text-[10px] leading-4 text-slate-400">
              *AI responses may require independent legal verification.
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Delete chat"
        message="This chat will be removed from your sidebar. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={deletingConversation}
        onClose={() => {
          if (!deletingConversation) {
            setPendingDeleteId(null);
          }
        }}
        onConfirm={async () => {
          if (!pendingDeleteId || !onDeleteConversation) return;

          try {
            setDeletingConversation(true);
            await onDeleteConversation(pendingDeleteId);
            setPendingDeleteId(null);
          } finally {
            setDeletingConversation(false);
          }
        }}
      />
    </aside>
  );
}