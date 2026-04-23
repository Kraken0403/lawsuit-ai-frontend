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
  "Give me murder cases where bail was granted",
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

function getBooleanValue(obj: unknown, key: string): boolean {
  if (!obj || typeof obj !== "object") return false;
  return (obj as Record<string, unknown>)[key] === true;
}

export function buildStreamingThoughts(
  phase: string,
  trace?: StreamTrace | null
) {
  const router = trace?.router;
  const phaseText = String(phase || "").trim();
  const phaseLower = phaseText.toLowerCase();

  const effectiveQuery = clampText(
    trace?.effectiveQuery || trace?.originalQuery || "",
    90
  );

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

  const answerType = getObjectValue(router, "answerType");
  const family = getObjectValue(router, "family");
  const subtype = getObjectValue(router, "subtype");
  const draftingObjective = getObjectValue(router, "draftingObjective");
  const missingFields = getStringArray(router, "missingFields");
  const isFollowUp = getBooleanValue(router, "isFollowUp");

  const extractedFactsCount = (() => {
    if (!router || typeof router !== "object") return 0;
    const value = (router as Record<string, unknown>)["extractedFacts"];
    if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
    return Object.keys(value as Record<string, unknown>).length;
  })();

  const thoughts: string[] = [];

  const isDraftingTrace =
    Boolean(answerType) ||
    Boolean(family) ||
    Boolean(subtype) ||
    Boolean(draftingObjective) ||
    missingFields.length > 0 ||
    isFollowUp;

  if (isDraftingTrace) {
    if (phaseText) thoughts.push(phaseText);

    if (effectiveQuery) {
      thoughts.push(`Working on: ${effectiveQuery}`);
    }

    if (draftingObjective) {
      thoughts.push(`Draft goal: ${clampText(draftingObjective, 90)}`);
    }

    if (family) {
      thoughts.push(`Document type: ${compactLabel(family)}`);
    }

    if (subtype) {
      thoughts.push(`Subtype: ${compactLabel(subtype)}`);
    }

    if (strategy) {
      thoughts.push(`Using ${compactLabel(strategy)} drafting flow`);
    }

    if (isFollowUp) {
      thoughts.push("Applying your follow-up changes to the existing draft");
    }

    if (extractedFactsCount > 0) {
      thoughts.push(`Using ${extractedFactsCount} extracted draft facts`);
    }

    if (missingFields.length > 0) {
      thoughts.push(
        `Checking missing details: ${clampText(
          missingFields.slice(0, 3).map(compactLabel).join(", "),
          90
        )}`
      );
    }

    if (phaseLower.includes("understanding drafting request")) {
      return uniqueStrings(
        [
          phaseText || "Understanding drafting request",
          effectiveQuery ? `Reading: ${effectiveQuery}` : "",
          draftingObjective
            ? `Understanding objective: ${clampText(draftingObjective, 90)}`
            : "",
          isFollowUp
            ? "Reviewing the current draft before editing it"
            : "Understanding the draft requirements",
          extractedFactsCount > 0
            ? `Found ${extractedFactsCount} usable draft facts`
            : "Checking facts, parties and placeholders",
        ].filter(Boolean)
      );
    }

    if (
      phaseLower.includes("matching templates") ||
      phaseLower.includes("matching precedents") ||
      phaseLower.includes("matching")
    ) {
      return uniqueStrings(
        [
          phaseText || "Matching templates and precedents",
          family ? `Looking for a strong ${compactLabel(family)} structure` : "",
          strategy ? `Using ${compactLabel(strategy)} matching` : "",
          rewrites[0] ? `Trying: ${clampText(rewrites[0], 90)}` : "",
          reasons[0] || "Comparing relevant templates, clauses and style",
        ].filter(Boolean)
      );
    }

    if (
      phaseLower.includes("collecting drafting facts") ||
      phaseLower.includes("collecting")
    ) {
      return uniqueStrings(
        [
          phaseText || "Collecting drafting facts",
          extractedFactsCount > 0
            ? `Using ${extractedFactsCount} extracted facts from your request`
            : "Extracting the key drafting facts",
          missingFields.length > 0
            ? `Flagging missing items: ${clampText(
                missingFields.slice(0, 3).map(compactLabel).join(", "),
                90
              )}`
            : "Checking whether any placeholders are still needed",
          isFollowUp
            ? "Merging new instructions into the existing draft"
            : "Preparing the draft inputs",
        ].filter(Boolean)
      );
    }

    if (
      phaseLower.includes("structuring and drafting document") ||
      phaseLower.includes("drafting document") ||
      phaseLower.includes("drafting")
    ) {
      return uniqueStrings(
        [
          phaseText || "Drafting document",
          family ? `Structuring the ${compactLabel(family)} properly` : "",
          subtype ? `Applying ${compactLabel(subtype)} wording` : "",
          isFollowUp
            ? "Updating clauses while preserving the current draft context"
            : "Building the draft with headings, clauses and formatting",
          "Keeping numbering, structure and placeholders aligned",
        ].filter(Boolean)
      );
    }

    if (phaseLower.includes("streaming answer")) {
      return uniqueStrings(
        [
          phaseText || "Streaming answer",
          "Finalizing the draft text",
          "Preparing the latest version for the editor",
          isFollowUp
            ? "Sending the updated draft version"
            : "Sending the generated draft version",
        ].filter(Boolean)
      );
    }

    return uniqueStrings(
      thoughts.length
        ? thoughts
        : [
            "Understanding drafting request",
            "Reviewing the draft requirements",
            "Preparing the document structure",
            "Drafting the content",
          ]
    );
  }

  if (phaseText) thoughts.push(phaseText);
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