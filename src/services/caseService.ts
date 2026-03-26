import { apiRequest } from "../lib/api";

export type QdrantFullCaseChunk = {
  pointId: string;
  chunkId: string;
  text: string;
  paragraphStart: number | null;
  paragraphEnd: number | null;
  chunkIndex: number | null;
  payload: Record<string, any>;
};

export type QdrantFullCase = {
  caseId: string;
  fileName: string;
  title: string;
  citation: string;
  court: string;
  dateOfDecision: string;
  judges: string[];
  caseType: string;
  caseNo: string;
  subject: string;
  actsReferred: string[];
  finalDecision: string;
  equivalentCitations: string[];
  advocates: string[];
  cited: number | null;
  chunkCount: number;
  chunks: QdrantFullCaseChunk[];
  fullText: string;
};

export type SqlFullCase = {
  caseId: string;
  ftype: string;
  flag: number | null;
  jtext: string;
};

type QdrantCaseResponse = {
  ok: boolean;
  source: "qdrant";
  case: QdrantFullCase;
};

type SqlCaseResponse = {
  ok: boolean;
  source: "sql";
  case: SqlFullCase;
};

type CombinedCaseResponse = {
  ok: boolean;
  caseId: string;
  qdrant: QdrantFullCase | { error: string };
  sql: SqlFullCase | { error: string };
};

export const caseService = {
  getFromQdrant(caseId: string | number) {
    return apiRequest<QdrantCaseResponse>(`/api/cases/${caseId}/qdrant`, {
      method: "GET",
    });
  },

  getFromSql(caseId: string | number) {
    return apiRequest<SqlCaseResponse>(`/api/cases/${caseId}/sql`, {
      method: "GET",
    });
  },

  getCombined(caseId: string | number) {
    return apiRequest<CombinedCaseResponse>(`/api/cases/${caseId}`, {
      method: "GET",
    });
  },
};