import type { AppView, WorkspaceView } from "./workspaceMode";

export type RouteState = {
  activeView: AppView;
  workspaceView: WorkspaceView | null;
  conversationId: string | null;
};

function cleanPath(pathname: string) {
  if (!pathname) return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function getRouteState(pathname: string): RouteState {
  const path = cleanPath(pathname);

  if (path === "/settings") {
    return {
      activeView: "settings",
      workspaceView: null,
      conversationId: null,
    };
  }

  if (path === "/credits") {
    return {
      activeView: "credits",
      workspaceView: null,
      conversationId: null,
    };
  }

  if (path === "/bookmarks" || path === "/briefcase") {
    return {
      activeView: "bookmarks",
      workspaceView: null,
      conversationId: null,
    };
  }

  if (path === "/drafting") {
    return {
      activeView: "drafting_document",
      workspaceView: "drafting_document",
      conversationId: null,
    };
  }

  if (path.startsWith("/drafting/")) {
    const conversationId = decodeURIComponent(path.slice("/drafting/".length));

    return {
      activeView: "drafting_document",
      workspaceView: "drafting_document",
      conversationId: conversationId || null,
    };
  }

  if (path === "/judgment" || path === "/") {
    return {
      activeView: "chat",
      workspaceView: "chat",
      conversationId: null,
    };
  }

  if (path.startsWith("/judgment/")) {
    const conversationId = decodeURIComponent(path.slice("/judgment/".length));

    return {
      activeView: "chat",
      workspaceView: "chat",
      conversationId: conversationId || null,
    };
  }

  return {
    activeView: "chat",
    workspaceView: "chat",
    conversationId: null,
  };
}

export function buildViewPath(view: AppView) {
  switch (view) {
    case "drafting_document":
      return "/drafting";
    case "bookmarks":
      return "/briefcase";
    case "settings":
      return "/settings";
    case "credits":
      return "/credits";
    case "chat":
    default:
      return "/judgment";
  }
}

export function buildConversationPath(
  view: WorkspaceView,
  conversationId: string
) {
  const safeId = encodeURIComponent(conversationId);

  return view === "drafting_document"
    ? `/drafting/${safeId}`
    : `/judgment/${safeId}`;
}