import { apiRequest } from "../lib/api";

export type BookmarkedCase = {
  id: string;
  externalCaseId: string | null;
  title: string;
  citation: string;
  payloadJson?: Record<string, unknown> | null;
  createdAt: string;
};

type ListBookmarksResponse = {
  ok: boolean;
  bookmarks: BookmarkedCase[];
};

type CreateBookmarkResponse = {
  ok: boolean;
  bookmark: BookmarkedCase;
};

export const bookmarkService = {
  list() {
    return apiRequest<ListBookmarksResponse>("/api/bookmarks/cases", {
      method: "GET",
    });
  },

  create(input: {
    externalCaseId?: string | null;
    title: string;
    citation: string;
    payload?: Record<string, unknown> | null;
  }) {
    return apiRequest<CreateBookmarkResponse>("/api/bookmarks/cases", {
      method: "POST",
      body: input,
    });
  },

  remove(bookmarkId: string) {
    return apiRequest<{ ok: boolean }>(`/api/bookmarks/cases/${bookmarkId}`, {
      method: "DELETE",
    });
  },
};