const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

type RequestOptions = RequestInit & {
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  if (!isFormData && options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
    body:
      options.body === undefined
        ? undefined
        : isFormData
        ? (options.body as FormData)
        : JSON.stringify(options.body),
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: string }).error || "Request failed")
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return payload as T;
}