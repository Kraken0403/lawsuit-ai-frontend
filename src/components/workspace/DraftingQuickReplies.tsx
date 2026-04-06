import type { StreamTrace } from "../../streamChat";
import { getDraftingRouterFromTrace } from "../../lib/workspaceMode";

type DraftingQuickRepliesProps = {
  trace?: StreamTrace | null;
  onSelect: (value: string) => void;
};

function buildQuickReplies(trace?: StreamTrace | null) {
  const router = getDraftingRouterFromTrace(trace);
  const missingFields = Array.isArray(router?.missingFields)
    ? router.missingFields.map((item) => String(item || "").trim())
    : [];

  const quickReplies: string[] = [];

  if (missingFields.includes("tone")) {
    quickReplies.push("Tone: formal");
    quickReplies.push("Tone: strict");
    quickReplies.push("Tone: aggressive");
  }

  if (missingFields.includes("deadline")) {
    quickReplies.push("Use a 7-day deadline.");
    quickReplies.push("Use a 15-day deadline.");
  }

  if (missingFields.includes("demands")) {
    quickReplies.push("Demand immediate payment of the outstanding amount.");
    quickReplies.push("Demand payment with interest and legal costs.");
  }

  if (missingFields.length > 0) {
    quickReplies.push("Use placeholders for any missing details and generate the first draft.");
  }

  return Array.from(new Set(quickReplies)).slice(0, 6);
}

export default function DraftingQuickReplies({
  trace,
  onSelect,
}: DraftingQuickRepliesProps) {
  const quickReplies = buildQuickReplies(trace);

  if (quickReplies.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {quickReplies.map((reply) => (
        <button
          key={reply}
          type="button"
          onClick={() => onSelect(reply)}
          className="rounded-full border border-[#d8d1ff] bg-[#f5f2ff] px-3 py-1.5 text-xs font-medium text-[#5b4ddb] transition hover:bg-[#ede7ff]"
        >
          {reply}
        </button>
      ))}
    </div>
  );
}