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

function compactLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function getObjectValue(obj: unknown, key: string) {
  if (!obj || typeof obj !== "object") return "";
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function getStringArray(obj: unknown, key: string): string[] {
  if (!obj || typeof obj !== "object") return [];
  const value = (obj as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function countUnresolvedBracketPlaceholders(text: string) {
  return (String(text || "").match(/\[[^\]]+\]/g) || []).length;
}

export function makeDraftingChatSummary(
  trace?: { router?: unknown } | null,
  draftText = ""
) {
  const router = trace?.router;

  const family = getObjectValue(router, "family");
  const subtype = getObjectValue(router, "subtype");
  const draftingObjective = getObjectValue(router, "draftingObjective");
  const strategy = getObjectValue(router, "strategy");
  const missingFields = getStringArray(router, "missingFields");
  const isFollowUp =
    !!router &&
    typeof router === "object" &&
    (router as Record<string, unknown>).isFollowUp === true;

  const unresolvedPlaceholderCount = countUnresolvedBracketPlaceholders(draftText);

  const readableFamily = family ? compactLabel(family) : "draft";
  const readableSubtype = subtype ? compactLabel(subtype) : "";
  const readableStrategy = strategy ? compactLabel(strategy) : "";

  const firstLine = readableSubtype
    ? `I’ve ${
        isFollowUp ? "updated" : "prepared"
      } the ${readableFamily} (${readableSubtype}) in the editor.`
    : `I’ve ${
        isFollowUp ? "updated" : "prepared"
      } the ${readableFamily} in the editor.`;

  const objectiveLine = draftingObjective
    ? `It is structured around this objective: ${draftingObjective}.`
    : readableStrategy
    ? `It has been generated using the ${readableStrategy} drafting flow.`
    : "";

  let placeholderLine = "";
  if (missingFields.length > 0 || unresolvedPlaceholderCount > 0) {
    placeholderLine =
      unresolvedPlaceholderCount > 0
        ? `A few placeholders or variable fields may still need to be reviewed and finalized before use.`
        : `I’ve also identified some details that may still need confirmation.`;
  }

  const proofreadingLine =
    "Please review the language, facts, names, dates, amounts, jurisdiction details, and clause intent carefully before relying on it.";

  const legalWarningLine =
    "Treat this as a working draft and proofread it properly, and where needed have it vetted by a qualified legal professional before using it for any legal purpose.";

  const closingLine = isFollowUp
    ? "Check the updated version on the right and tell me what you want revised next."
    : "Review it on the right and tell me what you want changed, expanded, tightened, or customized next.";

  return [
    firstLine,
    objectiveLine,
    placeholderLine,
    proofreadingLine,
    legalWarningLine,
    closingLine,
  ]
    .filter(Boolean)
    .join(" ");
}