import type {
  DraftBrandingSettings,
  ResolvedBrandingSettings,
} from "./draftingBranding";

function toAbsoluteUrl(url?: string | null) {
  const src = String(url || "").trim();
  if (!src) return "";

  if (
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  ) {
    return src;
  }

  try {
    return new URL(src, window.location.href).toString();
  } catch {
    return src;
  }
}

function looksLikeImageResponse(response: Response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  return (
    contentType.startsWith("image/") ||
    contentType.includes("octet-stream") ||
    contentType.includes("application/octet-stream")
  );
}

export async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => {
      reject(new Error("Failed to convert blob to data URL."));
    };

    reader.readAsDataURL(blob);
  });
}

export async function inlineImageIfPossible(url?: string | null) {
  const src = toAbsoluteUrl(url);
  if (!src) return "";

  if (src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }

  try {
    const response = await fetch(src, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return src;
    }

    if (!looksLikeImageResponse(response)) {
      return src;
    }

    const blob = await response.blob();
    if (!blob.size) {
      return src;
    }

    return await blobToDataUrl(blob);
  } catch {
    return src;
  }
}

export async function inlineBrandingImages(
  branding?: DraftBrandingSettings
): Promise<ResolvedBrandingSettings | undefined> {
  if (!branding) return undefined;

  const [headerImageUrl, footerImageUrl, letterheadImageUrl, signatureImageUrl] =
    await Promise.all([
      inlineImageIfPossible(branding.headerImageUrl),
      inlineImageIfPossible(branding.footerImageUrl),
      inlineImageIfPossible(branding.letterheadImageUrl),
      inlineImageIfPossible(branding.signatureImageUrl),
    ]);

  return {
    mode: branding.mode || "none",
    headerImageUrl,
    footerImageUrl,
    letterheadImageUrl,
    signatureImageUrl,
    headerHeightPx: branding.headerHeightPx || 110,
    footerHeightPx: branding.footerHeightPx || 90,
    letterheadHeightPx: branding.letterheadHeightPx || 130,
    lockBranding: branding.lockBranding !== false,
  };
}

export async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          let finished = false;

          const done = () => {
            if (finished) return;
            finished = true;
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };

          img.setAttribute("loading", "eager");
          img.setAttribute("decoding", "sync");

          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }

          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });

          window.setTimeout(done, 8000);
        })
    )
  );
}

export async function withMountedExportContainer<T>(
  html: string,
  callback: (container: HTMLElement) => Promise<T>
) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-100000px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.zIndex = "-1";
  container.style.background = "#ffffff";
  container.style.pointerEvents = "none";
  container.style.opacity = "0";
  container.innerHTML = html;

  document.body.appendChild(container);

  try {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve())
      )
    );

    await waitForImages(container);
    return await callback(container);
  } finally {
    container.remove();
  }
}