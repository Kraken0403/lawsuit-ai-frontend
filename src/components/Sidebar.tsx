import React, { useEffect, useRef, useState } from "react";
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
  userName?: string | null;
  onLogout?: () => void;
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

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
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
  inverted?: boolean; // when sidebar uses inverted blue background
  useBlue?: boolean; // when expanded sidebar uses blue bg, text should be white
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  if (collapsed) {
    // collapsed icon-only button: darker icon colors on collapse
    const iconClass = active ? "bg-[#0b3a6f] text-white" : "bg-transparent text-slate-700";
    const hoverClass = "hover:bg-slate-100";
    const btnBg = active ? "bg-slate-100" : hoverClass;

    return (
      <button
        type="button"
        onClick={onClick}
        title={label}
        className={`w-full p-2 rounded-md transition ${btnBg}`}
      >
        <div className="flex items-center justify-center">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold ${iconClass}`}>
            {icon}
          </div>
        </div>
      </button>
    );
  }

  

  // expanded button
  let containerClass = "";
  let iconBgClass = "";

  if (useBlue) {
    containerClass = active ? "bg-white/10 text-white" : "text-white hover:bg-white/5";
    iconBgClass = active ? "bg-white text-[#114C8D]" : "bg-transparent text-white/90";
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
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBgClass}`}>
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
  userName,
  onLogout,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const initials = (userName || "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const inverted = collapsed; // use inverted blue theme only when collapsed

  // Sidebar background forced to white — keep expandedBlue disabled
  const expandedBlue = false;

  return (
    <aside className={`hidden border-r ${inverted ? "border-white/10" : "border-slate-200"} bg-white text-slate-900 lg:flex lg:shrink-0 lg:flex-col ${collapsed ? "lg:w-[72px]" : "lg:w-[240px]"}`}>
      <div className={`border-b ${inverted ? "border-white/10" : "border-slate-200"} px-4 py-4`}>
        <div className={`mb-3 flex items-center ${collapsed ? 'justify-center' : ''}`}>
            <div className="min-w-0 flex items-center gap-3">
              <img src="/LawsuitAI%20Logo.png" alt="Lawsuit AI" className="h-8 object-contain" />
            </div>

            <div className={`${collapsed ? 'ml-0' : 'ml-auto'} flex items-center gap-2 ${collapsed ? 'justify-center w-full' : ''}`}>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${inverted ? "bg-transparent text-slate-700" : "bg-slate-100 text-slate-600"}`}
            >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 7h16" />
                        <path d="M4 12h16" />
                        <path d="M4 17h16" />
                      </svg>
            </button>
          </div>

        </div>

        <button
          type="button"
          onClick={() => {
            onChangeView("chat");
            onNewChat();
          }}
          className={`inline-flex w-full items-center justify-center gap-2 ${collapsed ? "p-2 rounded-md" : "rounded-2xl px-4 py-3"} ${inverted ? "bg-slate-100 text-slate-700" : "bg-[#114C8D] text-white"} transition hover:opacity-95`}
        >
          <PlusIcon />
          {!collapsed && <span>New chat</span>}
        </button>
      </div>

      <div className={`border-b ${inverted ? "border-white/10" : "border-slate-200"} px-3 py-3`}>
        <div className="space-y-1">
          <SidebarNavButton collapsed={collapsed} inverted={inverted} useBlue={!collapsed && expandedBlue} active={activeView === "chat"} icon={<ChatIcon />} label="Chats" onClick={() => onChangeView("chat")} />

          <SidebarNavButton collapsed={collapsed} inverted={inverted} useBlue={!collapsed && expandedBlue} active={activeView === "bookmarks"} icon={<BookmarkIcon />} label="Bookmarks" onClick={() => onChangeView("bookmarks")} />

          <SidebarNavButton collapsed={collapsed} inverted={inverted} useBlue={!collapsed && expandedBlue} active={activeView === "settings"} icon={<SettingsIcon />} label="Settings" onClick={() => onChangeView("settings")} />
        </div>
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 px-2">
            {!searchActive ? (
              <div className="flex items-center justify-between">
                <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${expandedBlue ? "text-white/80" : (inverted ? "text-white/80" : "text-slate-500")}`}>
                  Recent chats
                </div>
                <button type="button" onClick={() => setSearchActive(true)} className={`flex h-7 w-7 items-center justify-center rounded-xl ${expandedBlue ? "bg-white/5 text-white/80" : (inverted ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-400")}`}>
                  <SearchIcon />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm outline-none"
                />
                <button type="button" onClick={() => { setSearchActive(false); setSearchQuery(""); }} className="text-sm text-slate-500">Cancel</button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            {loading ? (
              <div className={`rounded-2xl border ${expandedBlue ? "border-white/10 bg-transparent text-white/80" : (inverted ? "border-white/10 bg-white/5 text-white/80" : "border-slate-200 bg-white text-slate-500")} p-4 text-sm`}>Loading chats...</div>
            ) : (() => {
              const q = searchQuery.trim().toLowerCase();
              const filtered = q ? conversations.filter((c) => (c.title || "").toLowerCase().includes(q) || (c.preview || "").toLowerCase().includes(q)) : conversations;
              if (filtered.length === 0) {
                return (
                  <div className={`rounded-2xl border ${expandedBlue ? "border-white/10 bg-transparent text-white/80" : (inverted ? "border-white/10 bg-white/5 text-white/80" : "border-dashed border-slate-200 bg-white text-slate-500")} p-4 text-sm leading-6`}>No conversations yet.</div>
                );
              }

              return filtered.map((item) => {
                const active = activeView === "chat" && item.id === activeConversationId;

                const btnClass = active
                  ? (expandedBlue ? "bg-white/10" : (inverted ? "bg-white/10" : "bg-blue-50"))
                  : (expandedBlue ? "hover:bg-white/5" : (inverted ? "hover:bg-white/5" : "hover:bg-white"));

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChangeView("chat");
                      onSelectConversation(item.id);
                    }}
                    className={`w-full rounded-2xl px-3 py-3 text-left transition ${btnClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`truncate text-sm font-medium ${expandedBlue ? (active ? "text-white" : "text-white/90") : (active ? (inverted ? "text-white" : "text-blue-800") : (inverted ? "text-white" : "text-slate-800"))}`}>{item.title}</div>
                        <div className={`mt-1 line-clamp-2 text-xs leading-5 ${expandedBlue ? "text-white/80" : (inverted ? "text-white/80" : "text-slate-500")}`}>{item.preview || "No messages yet"}</div>
                      </div>

                      <div className={`shrink-0 pt-0.5 text-[11px] ${expandedBlue ? "text-white/70" : (inverted ? "text-white/70" : "text-slate-400")}`}>{formatDate(item.lastMessageAt)}</div>
                    </div>
                  </button>
                );
              })
            })()}
          </div>
        </div>
      )}

      <div className={`mt-auto border-t ${inverted ? "border-white/10" : "border-slate-200"} px-4 py-4`}>
        {collapsed ? (
          <div className="flex items-center justify-center relative">
              <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold ${inverted ? "bg-slate-100 text-slate-700" : "bg-[#114C8D] text-white"}`}
                aria-label="Open profile menu"
              >
                {initials || "U"}
              </button>

              {/* small blue status dot */}
              <span className="absolute -right-1 bottom-1 h-2 w-2 rounded-full bg-[#114C8D] ring-1 ring-white" />

              {menuOpen && (
                <div
                  className="absolute left-full top-0 ml-2 rounded-md border shadow-sm py-1 z-50"
                  style={{ width: 240, background: '#114C8D' }}
                >
                  <button type="button" onClick={() => setMenuOpen(false)} className="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-white/5">
                    <UserIcon />
                    <span>Profile</span>
                  </button>

                  <button type="button" onClick={() => setMenuOpen(false)} className="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-white/5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16v16H4z" />
                      <path d="M4 8h16" />
                    </svg>
                    <span>Settings</span>
                    <span className="ml-auto text-xs text-white/70">Ctrl+,</span>
                  </button>

                  <button type="button" onClick={() => setMenuOpen(false)} className="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-white/5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 8h8" />
                      <path d="M8 12h8" />
                      <path d="M8 16h8" />
                    </svg>
                    <span>Language</span>
                  </button>

                  <button type="button" onClick={() => setMenuOpen(false)} className="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-white/5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l2 4 4 .6-3 2.8.8 4-3.8-2-3.8 2 .8-4-3-2.8 4-.6z" />
                    </svg>
                    <span>Get help</span>
                  </button>

                  <button type="button" onClick={() => setMenuOpen(false)} className="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-white/5">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 8h10" />
                      <path d="M7 12h10" />
                      <path d="M7 16h7" />
                    </svg>
                    <span>Upgrade plan</span>
                  </button>

                  <div className="border-t border-white/20 mt-1" />

                  <button type="button" onClick={() => setConfirmLogout(true)} className="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-white/5">
                    <LogoutIcon />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-full bg-[#114C8D] flex items-center justify-center text-white font-semibold`}>{initials || "U"}</div>

              <div className="min-w-0">
                <div className={`truncate text-sm font-medium ${expandedBlue ? "text-white" : (inverted ? "text-white" : "text-slate-900")}`}>{userName || ""}</div>
                <div className={`text-xs ${expandedBlue ? "text-white/80" : (inverted ? "text-white/80" : "text-slate-500")}`}>Account</div>
              </div>
            </div>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${inverted ? "text-white hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"}`}
                aria-label="Open profile menu"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute left-0 bottom-full mb-3 rounded-md border shadow-sm py-1 z-50" style={{ width: 240, background: '#114C8D' }}>
                  <button type="button" onClick={() => setMenuOpen(false)} className="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-white/5">
                    <UserIcon />
                    <span>Profile</span>
                  </button>

                  <button type="button" onClick={() => setConfirmLogout(true)} className="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-white/5">
                    <LogoutIcon />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {confirmLogout && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Confirm logout</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to log out?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmLogout(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
              <button onClick={() => { setConfirmLogout(false); setMenuOpen(false); onLogout?.(); }} className="rounded-md bg-[#114C8D] px-3 py-2 text-sm text-white hover:bg-[#0b3a6f]">Logout</button>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
}
