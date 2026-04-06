import type { ConversationChatMode } from "../services/conversationService";
import { makeStarterMessage, type AppMessage } from "./appHelpers";
import type { StreamTrace } from "../streamChat";

export type WorkspaceView = "chat" | "drafting_document";
export type AppView = WorkspaceView | "bookmarks" | "settings";
export type DraftingAnswerType = "drafting_questions" | "drafting_draft" | null;

export function isWorkspaceView(view: AppView): view is WorkspaceView {
  return view === "chat" || view === "drafting_document";
}

export function getChatModeForView(view: WorkspaceView): ConversationChatMode {
  return view === "drafting_document" ? "drafting_studio" : "judgment";
}

export function getViewForChatMode(chatMode?: ConversationChatMode): WorkspaceView {
  return chatMode === "drafting_studio" ? "drafting_document" : "chat";
}

export function makeWorkspaceStarterMessage(view: WorkspaceView): AppMessage {
  const base = makeStarterMessage();

  if (view === "drafting_document") {
    return {
      ...base,
      content:
        "Welcome to Drafting Studio. Describe the notice, agreement, reply, clause, or legal draft you want to create.",
    };
  }

  return base;
}

export function getDraftingRouterFromTrace(trace?: StreamTrace | null) {
  const router = trace && typeof trace === "object" ? (trace as any).router : null;
  return router && typeof router === "object"
    ? (router as Record<string, unknown>)
    : null;
}

export function getDraftingAnswerTypeFromTrace(
  trace?: StreamTrace | null
): DraftingAnswerType {
  const router = getDraftingRouterFromTrace(trace);
  const answerType = typeof router?.answerType === "string" ? router.answerType : null;

  if (answerType === "drafting_questions" || answerType === "drafting_draft") {
    return answerType;
  }

  return null;
}

export function makeDraftingChatSummary(trace?: StreamTrace | null, fallbackText = "") {
  const router = getDraftingRouterFromTrace(trace);
  const family =
    typeof router?.family === "string"
      ? router.family.replace(/_/g, " ")
      : "draft";
  const objective =
    typeof router?.draftingObjective === "string" ? router.draftingObjective : "";
  const tone =
    typeof router?.preferredTone === "string" && router.preferredTone !== "neutral"
      ? `${router.preferredTone} `
      : "";

  if (objective) {
    return `I generated a ${tone}${family} draft in the editor for: ${objective}. Review it in the docked workspace and tell me what to revise.`;
  }

  if (fallbackText.trim()) {
    return `Your draft is ready in the editor. Review it on the right and tell me what to change next.`;
  }

  return `Your ${tone}${family} draft is ready in the editor.`;
}