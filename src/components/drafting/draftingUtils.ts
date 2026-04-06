export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function markdownishTextToHtml(text: string) {
  if (!text.trim()) return "<p></p>";
  if (looksLikeHtml(text)) return text;

  const lines = text.replace(/\r/g, "").split("\n");
  const html: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeLists();
      html.push("<p><br /></p>");
      continue;
    }

    if (line.startsWith("# ")) {
      closeLists();
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeLists();
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      closeLists();
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      if (!inOl) {
        closeLists();
        html.push("<ol>");
        inOl = true;
      }
      html.push(`<li>${escapeHtml(line.replace(/^\d+\.\s/, ""))}</li>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inUl) {
        closeLists();
        html.push("<ul>");
        inUl = true;
      }
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }

    closeLists();
    html.push(`<p>${escapeHtml(line)}</p>`);
  }

  closeLists();
  return html.join("");
}

export function extractDocBody(fullHtml: string) {
  if (!fullHtml?.trim()) return "";

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return fullHtml;
  }

  try {
    const doc = new DOMParser().parseFromString(fullHtml, "text/html");
    const body = doc.querySelector(".doc-body");
    return body?.innerHTML?.trim() || fullHtml;
  } catch {
    return fullHtml;
  }
}

export function pxToTwip(px: number) {
  return Math.max(0, Math.round(px * 15));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function safeFileName(value: string) {
  return (value || "draft").replace(/[^\w\s-]/g, "").trim() || "draft";
}