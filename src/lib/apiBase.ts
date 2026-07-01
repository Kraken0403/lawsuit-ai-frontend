const DEFAULT_LOCAL_API_BASE = "http://localhost:8787";

function isLocalHttpUrl(url: URL) {
  return (
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  );
}

function resolveApiBase() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  const fallback =
    typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? window.location.origin
      : DEFAULT_LOCAL_API_BASE;

  const candidate = configured || fallback;

  if (typeof window === "undefined") {
    return candidate.replace(/\/+$/, "");
  }

  try {
    const url = new URL(candidate, window.location.origin);

    if (
      window.location.protocol === "https:" &&
      url.protocol === "http:" &&
      !isLocalHttpUrl(url)
    ) {
      console.warn(
        "[api] Ignoring insecure VITE_API_BASE_URL on HTTPS page:",
        candidate
      );
      return window.location.origin.replace(/\/+$/, "");
    }

    return url.origin.replace(/\/+$/, "");
  } catch {
    return fallback.replace(/\/+$/, "");
  }
}

export const API_BASE = resolveApiBase();
