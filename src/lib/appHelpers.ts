import type { BookmarkedCase } from "../services/bookmarkService";
import type { ConversationMessage } from "../services/conversationService";
import type { CaseDigest, SourceItem, StreamTrace } from "../streamChat";

export type AppMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  sources?: SourceItem[];
  caseDigests?: CaseDigest[];
  trace?: StreamTrace | null;
};

export const STARTER_MESSAGE =
  "Ask me a case question, doctrine question, citation request, holding query, summary request, or a comparison between cases.";

export const SUGGESTIONS = [
  "What is the basic structure doctrine?",
  "Summarize Kesavananda Bharati.",
  "Compare Golaknath and Kesavananda Bharati.",
  "Give me the holding in Maneka Gandhi.",
];

export function uuid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function clampText(text: string, max = 110) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

export function compactLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function getObjectValue(obj: unknown, key: string) {
  if (!obj || typeof obj !== "object") return "";
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function getStringArray(obj: unknown, key: string): string[] {
  if (!obj || typeof obj !== "object") return [];
  const value = (obj as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function getNestedString(obj: unknown, path: string[]): string {
  let current: unknown = obj;

  for (const key of path) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current.trim() : "";
}

export function getNestedStringArray(obj: unknown, path: string[]): string[] {
  let current: unknown = obj;

  for (const key of path) {
    if (!current || typeof current !== "object") return [];
    current = (current as Record<string, unknown>)[key];
  }

  if (!Array.isArray(current)) return [];

  return current
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function uniqueStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

export function buildStreamingThoughts(
  phase: string,
  trace?: StreamTrace | null
) {
  const router = trace?.router;

  const strategy = getObjectValue(router, "strategy");
  const taskType =
    getObjectValue(router, "taskType") || getObjectValue(router, "intent");
  const caseTarget = getNestedString(router, ["entities", "caseTarget"]);
  const metadataField = getNestedString(router, ["entities", "metadataField"]);
  const rewrites = getNestedStringArray(router, [
    "retrievalPlan",
    "queryRewrites",
  ]);
  const reasons = getStringArray(router, "reasons");

  const thoughts: string[] = [];

  if (phase) thoughts.push(phase);
  if (caseTarget) thoughts.push(`Looking at ${clampText(caseTarget, 70)}`);
  if (metadataField) {
    thoughts.push(`Checking ${compactLabel(metadataField)} details`);
  }
  if (strategy) thoughts.push(`Using ${compactLabel(strategy)} retrieval`);
  if (taskType) thoughts.push(`Handling ${compactLabel(taskType)}`);
  if (rewrites[0]) thoughts.push(`Thinking: ${clampText(rewrites[0], 90)}`);
  if (reasons[0]) thoughts.push(clampText(reasons[0], 120));
  if (reasons[1]) thoughts.push(clampText(reasons[1], 120));

  return uniqueStrings(
    thoughts.length
      ? thoughts
      : [
          "Thinking",
          "Reviewing sources",
          "Checking the best match",
          "Drafting the answer",
        ]
  );
}

export function makeStarterMessage(): AppMessage {
  return {
    id: uuid(),
    role: "assistant",
    content: STARTER_MESSAGE,
    sources: [],
    caseDigests: [],
    trace: null,
  };
}

export function deriveConversationTitle(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  if (clean.length <= 60) return clean;
  return `${clean.slice(0, 60).trim()}...`;
}

export function getCaseKeyFromDigest(
  item: Pick<CaseDigest, "title" | "citation">
) {
  return `${item.title}|${item.citation}`;
}

export function mapStoredMessages(
  messages: ConversationMessage[]
): AppMessage[] {
  if (!messages.length) {
    return [makeStarterMessage()];
  }

  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    streaming: false,
    sources: Array.isArray(message.sources) ? message.sources : [],
    caseDigests: Array.isArray(message.caseDigests) ? message.caseDigests : [],
    trace: message.trace || null,
  }));
}

export function bookmarkToCaseDigest(bookmark: BookmarkedCase): CaseDigest {
  const payload = bookmark.payloadJson;
  const summary =
    payload &&
    typeof payload === "object" &&
    "summary" in payload &&
    typeof payload.summary === "string"
      ? payload.summary
      : "Saved bookmark";

  return {
    caseId: bookmark.externalCaseId ? Number(bookmark.externalCaseId) : 0,
    title: bookmark.title,
    citation: bookmark.citation,
    summary,
  };
}