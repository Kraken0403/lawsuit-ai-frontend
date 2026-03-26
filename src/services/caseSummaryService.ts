import { apiRequest } from "../lib/api";

export type DetailedCaseSummary = {
  id: string;
  caseId: string;
  fileName: string | null;
  title: string | null;
  citation: string | null;
  summaryType: string;
  sourceType: string;
  sourceHash: string;
  modelName: string;
  status: string;
  sectionsJson: {
    overview: string;
    facts: string;
    proceduralHistory: string;
    issues: string[];
    holding: string;
    reasoning: string;
    statutesAndArticles: string[];
    precedentsDiscussed: string[];
    finalDisposition: string;
    bench: string[];
    keyTakeaways: string[];
  };
  renderedMarkdown: string;
  createdAt: string;
  updatedAt: string;
};

type DetailedSummaryResponse = {
  ok: boolean;
  summaryType: "detailed_v1";
  cached: boolean;
  summary: DetailedCaseSummary;
};

export const caseSummaryService = {
  getDetailed(caseId: string | number) {
    return apiRequest<DetailedSummaryResponse>(
      `/api/cases/${caseId}/summary/detailed`,
      {
        method: "GET",
      }
    );
  },
};