import { escapeHtml } from "./draftingUtils";

export type DraftBrandingMode = "none" | "header_footer" | "letterhead";

export type DraftBrandingSettings = {
  mode?: DraftBrandingMode;
  headerImageUrl?: string | null;
  footerImageUrl?: string | null;
  letterheadImageUrl?: string | null;
  signatureImageUrl?: string | null;
  headerHeightPx?: number;
  footerHeightPx?: number;
  letterheadHeightPx?: number;
  lockBranding?: boolean;
};

export type ResolvedBrandingSettings = {
  mode: DraftBrandingMode;
  headerImageUrl: string;
  footerImageUrl: string;
  letterheadImageUrl: string;
  signatureImageUrl: string;
  headerHeightPx: number;
  footerHeightPx: number;
  letterheadHeightPx: number;
  lockBranding: boolean;
};

function resolveBrandingSettings(
  branding?: DraftBrandingSettings
): ResolvedBrandingSettings {
  return {
    mode: branding?.mode || "none",
    headerImageUrl: branding?.headerImageUrl?.trim() || "",
    footerImageUrl: branding?.footerImageUrl?.trim() || "",
    letterheadImageUrl: branding?.letterheadImageUrl?.trim() || "",
    signatureImageUrl: branding?.signatureImageUrl?.trim() || "",
    headerHeightPx: branding?.headerHeightPx || 110,
    footerHeightPx: branding?.footerHeightPx || 90,
    letterheadHeightPx: branding?.letterheadHeightPx || 130,
    lockBranding: branding?.lockBranding !== false,
  };
}

function buildImageHtml({
  url,
  alt,
  className = "",
  heightPx,
}: {
  url: string;
  alt: string;
  className?: string;
  heightPx: number;
}) {
  if (!url) return "";

  const classAttr = ["doc-branding-image", className].filter(Boolean).join(" ");

  return `
    <div class="doc-branding-block">
      <img
        src="${escapeHtml(url)}"
        alt="${escapeHtml(alt)}"
        class="${classAttr}"
        style="display:block; width:100%; max-width:100%; height:${heightPx}px; object-fit:contain;"
      />
    </div>
  `;
}

export function buildBrandingBlocks(branding?: DraftBrandingSettings) {
  const resolved = resolveBrandingSettings(branding);
  const lockClass = resolved.lockBranding ? "mceNonEditable" : "";

  let headerHtml = "";
  let footerHtml = "";

  if (resolved.mode === "letterhead" && resolved.letterheadImageUrl) {
    headerHtml = `
      <div class="${lockClass}">
        ${buildImageHtml({
          url: resolved.letterheadImageUrl,
          alt: "Letterhead",
          className: "doc-letterhead-image",
          heightPx: resolved.letterheadHeightPx,
        })}
      </div>
    `;
  } else if (resolved.mode === "header_footer" && resolved.headerImageUrl) {
    headerHtml = `
      <div class="${lockClass}">
        ${buildImageHtml({
          url: resolved.headerImageUrl,
          alt: "Header",
          heightPx: resolved.headerHeightPx,
        })}
      </div>
    `;
  }

  if (
    (resolved.mode === "letterhead" || resolved.mode === "header_footer") &&
    resolved.footerImageUrl
  ) {
    footerHtml = `
      <div class="${lockClass}">
        ${buildImageHtml({
          url: resolved.footerImageUrl,
          alt: "Footer",
          className: "doc-footer-image",
          heightPx: resolved.footerHeightPx,
        })}
      </div>
    `;
  }

  return { headerHtml, footerHtml };
}

export function buildEditorDocument(
  bodyHtml: string,
  branding?: DraftBrandingSettings
) {
  const { headerHtml, footerHtml } = buildBrandingBlocks(branding);

  return `
    <div class="doc-shell">
      ${headerHtml ? `<div class="doc-header">${headerHtml}</div>` : ""}
      <div class="doc-body">${bodyHtml || "<p></p>"}</div>
      ${footerHtml ? `<div class="doc-footer">${footerHtml}</div>` : ""}
    </div>
  `;
}

export function getBrandingHeights(branding?: DraftBrandingSettings) {
  const resolved = resolveBrandingSettings(branding);

  const headerHeightPx =
    resolved.mode === "letterhead" && resolved.letterheadImageUrl
      ? resolved.letterheadHeightPx
      : resolved.mode === "header_footer" && resolved.headerImageUrl
        ? resolved.headerHeightPx
        : 0;

  const footerHeightPx =
    (resolved.mode === "letterhead" || resolved.mode === "header_footer") &&
    resolved.footerImageUrl
      ? resolved.footerHeightPx
      : 0;

  return {
    headerHeightPx,
    footerHeightPx,
  };
}

export function buildPdfExportMarkup(
  title: string,
  bodyHtml: string,
  branding?: DraftBrandingSettings
) {
  const { headerHtml, footerHtml } = buildBrandingBlocks(branding);

  return `
    <style>
      .pdf-export-shell {
        width: 794px;
        box-sizing: border-box;
        background: #ffffff;
        padding: 40px 64px 56px;
        font-family: Georgia, serif;
        color: #1e293b;
        word-break: break-word;
      }

      .pdf-export-shell .doc-shell {
        width: 100%;
      }

      .pdf-export-shell .doc-header,
      .pdf-export-shell .doc-footer,
      .pdf-export-shell .doc-branding-block {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .pdf-export-shell .doc-header {
        margin-bottom: 20px;
      }

      .pdf-export-shell .doc-footer {
        margin-top: 28px;
      }

      .pdf-export-shell .doc-branding-block {
        width: 100%;
      }

      .pdf-export-shell .doc-branding-image {
        display: block;
        width: 100%;
        max-width: 100%;
        object-fit: contain;
      }

      .pdf-export-shell .doc-letterhead-image {
        margin-bottom: 6px;
      }

      .pdf-export-shell .doc-footer-image {
        margin-top: 10px;
      }

      .pdf-export-shell .doc-body {
        min-height: 220px;
      }

      .pdf-export-shell .doc-title {
        margin: 0 0 26px;
        font-size: 32px;
        line-height: 1.25;
        font-weight: 700;
        text-align: center;
        color: #0f172a;
      }

      .pdf-export-shell .doc-section-title {
        margin: 30px 0 12px;
        font-size: 22px;
        line-height: 1.35;
        font-weight: 700;
        color: #0f172a;
      }

      .pdf-export-shell .doc-subsection-title {
        margin: 22px 0 10px;
        font-size: 18px;
        line-height: 1.4;
        font-weight: 700;
        color: #1e293b;
      }

      .pdf-export-shell h1 { font-size: 30px; margin: 0 0 18px; }
      .pdf-export-shell h2 { font-size: 24px; margin: 26px 0 14px; }
      .pdf-export-shell h3 { font-size: 19px; margin: 20px 0 10px; }

      .pdf-export-shell p {
        margin: 0 0 14px;
      }

      .pdf-export-shell ul,
      .pdf-export-shell ol {
        margin: 0 0 16px 24px;
      }

      .pdf-export-shell li {
        break-inside: avoid;
        margin-bottom: 6px;
      }

      .pdf-export-shell table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        table-layout: fixed;
      }

      .pdf-export-shell th,
      .pdf-export-shell td {
        border: 1px solid #cbd5e1;
        padding: 8px 10px;
        vertical-align: top;
      }

      .pdf-export-shell a {
        color: #2563eb;
        text-decoration: underline;
      }

      .pdf-export-shell blockquote {
        border-left: 4px solid #cbd5e1;
        margin: 16px 0;
        padding-left: 12px;
        color: #475569;
      }
    </style>

    <div class="pdf-export-shell" data-export-title="${escapeHtml(title || "Draft")}">
      <div class="doc-shell">
        ${headerHtml ? `<div class="doc-header">${headerHtml}</div>` : ""}
        <div class="doc-body">${bodyHtml || "<p></p>"}</div>
        ${footerHtml ? `<div class="doc-footer">${footerHtml}</div>` : ""}
      </div>
    </div>
  `;
}

export function buildDocxBodyHtml(bodyHtml: string) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Georgia, serif;
            color: #1e293b;
            font-size: 14px;
            line-height: 1.9;
          }

          .doc-body {
            width: 100%;
          }

          .doc-title {
            margin: 0 0 26px;
            font-size: 32px;
            line-height: 1.25;
            font-weight: 700;
            text-align: center;
            color: #0f172a;
          }

          .doc-section-title {
            margin: 30px 0 12px;
            font-size: 22px;
            line-height: 1.35;
            font-weight: 700;
            color: #0f172a;
          }

          .doc-subsection-title {
            margin: 22px 0 10px;
            font-size: 18px;
            line-height: 1.4;
            font-weight: 700;
            color: #1e293b;
          }

          img {
            max-width: 100%;
          }

          h1 { font-size: 30px; margin: 0 0 18px; }
          h2 { font-size: 24px; margin: 26px 0 14px; }
          h3 { font-size: 19px; margin: 20px 0 10px; }

          p {
            margin: 0 0 14px;
          }

          ul, ol {
            margin: 0 0 16px 24px;
          }

          li {
            margin-bottom: 6px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            table-layout: fixed;
          }

          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            vertical-align: top;
          }

          a {
            color: #2563eb;
            text-decoration: underline;
          }

          blockquote {
            border-left: 4px solid #cbd5e1;
            margin: 16px 0;
            padding-left: 12px;
            color: #475569;
          }
        </style>
      </head>
      <body>
        <div class="doc-body">
          ${bodyHtml || "<p></p>"}
        </div>
      </body>
    </html>
  `;
}

export function buildDocxHeaderFooterHtml(branding?: DraftBrandingSettings) {
  const resolved = resolveBrandingSettings(branding);
  const { headerHeightPx, footerHeightPx } = getBrandingHeights(branding);

  let headerHtml = "";
  let footerHtml = "";

  if (resolved.mode === "letterhead" && resolved.letterheadImageUrl) {
    headerHtml = `
      <div style="width:100%; margin:0; padding:0; font-size:0; line-height:0;">
        <img
          src="${escapeHtml(resolved.letterheadImageUrl)}"
          alt="Letterhead"
          style="display:block; width:100%; height:${headerHeightPx}px;"
        />
      </div>
    `;
  } else if (resolved.mode === "header_footer" && resolved.headerImageUrl) {
    headerHtml = `
      <div style="width:100%; margin:0; padding:0; font-size:0; line-height:0;">
        <img
          src="${escapeHtml(resolved.headerImageUrl)}"
          alt="Header"
          style="display:block; width:100%; height:${headerHeightPx}px;"
        />
      </div>
    `;
  }

  if (
    (resolved.mode === "letterhead" || resolved.mode === "header_footer") &&
    resolved.footerImageUrl
  ) {
    footerHtml = `
      <div style="width:100%; margin:0; padding:0; font-size:0; line-height:0;">
        <img
          src="${escapeHtml(resolved.footerImageUrl)}"
          alt="Footer"
          style="display:block; width:100%; height:${footerHeightPx}px;"
        />
      </div>
    `;
  }

  return {
    headerHtml,
    footerHtml,
    headerHeightPx,
    footerHeightPx,
  };
}