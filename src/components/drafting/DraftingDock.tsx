import { useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyMCEEditorType } from "tinymce";
// import HtmlToDocx from "@turbodocx/html-to-docx";

import "tinymce/tinymce";
import "tinymce/models/dom/model";
import "tinymce/themes/silver";
import "tinymce/icons/default";

import "tinymce/skins/ui/oxide/skin";
import "tinymce/skins/content/default/content";
import "tinymce/skins/ui/oxide/content";

import "tinymce/plugins/advlist";
import "tinymce/plugins/autolink";
import "tinymce/plugins/lists";
import "tinymce/plugins/link";
import "tinymce/plugins/image";
import "tinymce/plugins/charmap";
import "tinymce/plugins/anchor";
import "tinymce/plugins/searchreplace";
import "tinymce/plugins/visualblocks";
import "tinymce/plugins/code";
import "tinymce/plugins/insertdatetime";
import "tinymce/plugins/media";
import "tinymce/plugins/table";
import "tinymce/plugins/wordcount";
import "tinymce/plugins/quickbars";
import "tinymce/plugins/pagebreak";
import "tinymce/plugins/nonbreaking";

import {
  buildEditorDocument,
  type DraftBrandingSettings,
} from "./draftingBranding";
import {
  inlineBrandingImages,
} from "./draftingExport";
import {
  downloadBlob,
  extractDocBody,
  looksLikeHtml,
  markdownishTextToHtml,
  safeFileName,
} from "./draftingUtils";

type DraftingDockProps = {
  conversationTitle: string;
  draftText: string;
  draftDocumentId: string | null;
  draftingAnswerType: string | null;
  draftingObjective: string;
  draftingSources: Array<{
    title: string;
    citation: string;
    range?: string;
  }>;
  draftingMissingFields: string[];
  draftingExtractedFacts: Record<string, unknown>;
  onDraftChange?: (html: string) => void;
  onClose?: () => void;
  branding?: DraftBrandingSettings;
};

const DEFAULT_FONT_STACK = "'Times New Roman', Times, serif";

const DRAFT_EDITOR_CSS = `
  body {
    font-family: ${DEFAULT_FONT_STACK};
    font-size: 12pt;
    line-height: 1.45;
    color: #1e293b;
    background: #ffffff;
    box-sizing: border-box;
    max-width: 768px;
    margin: 0 auto 30px;
    padding: 42px 56px 84px;
  }

  .doc-shell,
  .doc-body {
    width: 100%;
  }

  .doc-title {
    margin: 0 0 18pt;
    font-family: ${DEFAULT_FONT_STACK};
    font-size: 20pt;
    line-height: 1.25;
    font-weight: 700;
    text-align: center;
    color: #0f172a;
  }

  .doc-section-title {
    margin: 18pt 0 8pt;
    font-family: ${DEFAULT_FONT_STACK};
    font-size: 14pt;
    line-height: 1.3;
    font-weight: 700;
    color: #0f172a;
  }

  .doc-subsection-title {
    margin: 14pt 0 6pt;
    font-family: ${DEFAULT_FONT_STACK};
    font-size: 12pt;
    line-height: 1.3;
    font-weight: 700;
    color: #0f172a;
  }

  .doc-header {
    margin-bottom: 14pt;
  }

  .doc-footer {
    margin-top: 18pt;
  }

  .doc-branding-block {
    width: 100%;
  }

  .doc-branding-image {
    display: block;
    width: 100%;
    max-width: 100%;
    object-fit: contain;
    user-select: none;
    pointer-events: auto;
  }

  .doc-letterhead-image {
    margin-bottom: 6pt;
  }

  .doc-footer-image {
    margin-top: 8pt;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${DEFAULT_FONT_STACK};
    color: #0f172a;
  }

  h1 { font-size: 20pt; margin: 0 0 12pt; line-height: 1.25; }
  h2 { font-size: 14pt; margin: 18pt 0 8pt; line-height: 1.3; }
  h3 { font-size: 12pt; margin: 14pt 0 6pt; line-height: 1.3; }
  h4 { font-size: 11pt; margin: 12pt 0 6pt; line-height: 1.3; }

  p {
    margin: 0 0 8pt;
    line-height: 1.45;
  }

  ul,
  ol {
    margin: 0 0 8pt 24px;
    padding: 0;
    line-height: 1.45;
  }

  li {
    margin: 0 0 4pt;
    line-height: 1.45;
  }

  li p {
    margin: 0;
    line-height: 1.45;
  }

  a {
    color: #2563eb;
    text-decoration: underline;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 12pt 0;
    table-layout: fixed;
  }

  td, th {
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
    vertical-align: top;
    line-height: 1.35;
  }

  blockquote {
    border-left: 4px solid #cbd5e1;
    margin: 12pt 0;
    padding-left: 12px;
    color: #475569;
  }
`;

function applyEditorLayout(editor: TinyMCEEditorType, height: number) {
  const container = editor.getContainer();
  if (!container) return;

  container.classList.add("drafting-editor-instance");
  container.style.setProperty("visibility", "visible");
  container.style.setProperty("height", `${height}px`, "important");
  container.style.setProperty("min-height", `${height}px`, "important");
  container.style.setProperty("max-height", `${height}px`, "important");

  const statusbar = container.querySelector(".tox-statusbar") as HTMLElement | null;
  const chromeHeight = statusbar?.offsetHeight || 0;
  const contentHeight = height - chromeHeight - 20;

  const editorContainer = container.querySelector(
    ".tox-editor-container"
  ) as HTMLElement | null;
  if (editorContainer) {
    editorContainer.style.setProperty("height", `${contentHeight}px`, "important");
    editorContainer.style.setProperty("min-height", `${contentHeight}px`, "important");
    editorContainer.style.setProperty("max-height", `${contentHeight}px`, "important");
  }

  const sidebarWrap = container.querySelector(
    ".tox-sidebar-wrap"
  ) as HTMLElement | null;
  if (sidebarWrap) {
    sidebarWrap.style.setProperty("height", `${contentHeight}px`, "important");
    sidebarWrap.style.setProperty("min-height", `${contentHeight}px`, "important");
    sidebarWrap.style.setProperty("max-height", `${contentHeight}px`, "important");
  }

  const editArea = container.querySelector(".tox-edit-area") as HTMLElement | null;
  if (editArea) {
    editArea.style.setProperty("height", `${contentHeight}px`, "important");
    editArea.style.setProperty("min-height", `${contentHeight}px`, "important");
    editArea.style.setProperty("max-height", `${contentHeight}px`, "important");
  }

  const iframe = container.querySelector(
    ".tox-edit-area__iframe"
  ) as HTMLIFrameElement | null;
  if (iframe) {
    iframe.style.setProperty("height", `${contentHeight}px`, "important");
    iframe.style.setProperty("min-height", `${contentHeight}px`, "important");
    iframe.style.setProperty("max-height", `${contentHeight}px`, "important");
  }
}
function mergeAdjacentOrderedLists(root: HTMLElement) {
  const children = Array.from(root.children) as HTMLElement[];

  for (let i = 0; i < children.length - 1; i += 1) {
    const current = children[i];
    const next = children[i + 1];

    if (!current || !next) continue;

    if (current.tagName === "OL" && next.tagName === "OL") {
      while (next.firstChild) {
        current.appendChild(next.firstChild);
      }
      next.remove();
      i -= 1;
    }
  }
}

function convertNumberedParagraphsToList(root: HTMLElement) {
  const children = Array.from(root.children) as HTMLElement[];
  const rebuilt: HTMLElement[] = [];
  let currentList: HTMLOListElement | null = null;

  const flushList = () => {
    if (currentList) {
      rebuilt.push(currentList);
      currentList = null;
    }
  };

  for (const child of children) {
    const text = (child.textContent || "").trim();
    const numberedMatch = text.match(/^(\d+)[.)]\s+(.*)$/);

    if (
      child.tagName === "P" &&
      numberedMatch &&
      numberedMatch[2] &&
      !child.querySelector("img,table,blockquote")
    ) {
      if (!currentList) {
        currentList = root.ownerDocument.createElement("ol");
      }

      const li = root.ownerDocument.createElement("li");
      li.innerHTML = numberedMatch[2];
      currentList.appendChild(li);
      child.remove();
      continue;
    }

    flushList();
    rebuilt.push(child);
  }

  flushList();

  root.innerHTML = "";
  for (const node of rebuilt) {
    root.appendChild(node);
  }
}

function applyDraftPreset(bodyHtml: string) {
  const safeHtml = bodyHtml?.trim() ? bodyHtml : "<p></p>";
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="draft-root">${safeHtml}</div>`, "text/html");
  const root = doc.getElementById("draft-root");

  if (!root) return safeHtml;

  const blocks = Array.from(root.children).filter((node) =>
    (node.textContent || "").trim()
  ) as HTMLElement[];

  if (blocks.length) {
    const first = blocks[0];
    const firstText = (first.textContent || "").trim();
    const shouldTreatAsTitle =
      firstText.length > 0 &&
      firstText.length <= 180 &&
      !["UL", "OL", "TABLE", "BLOCKQUOTE"].includes(first.tagName);

    if (shouldTreatAsTitle) {
      if (first.tagName === "H1") {
        first.classList.add("doc-title");
      } else {
        const title = doc.createElement("h1");
        title.className = "doc-title";
        title.innerHTML = first.innerHTML;
        first.replaceWith(title);
      }
    }
  }

  root.querySelectorAll("h2").forEach((node) => {
    node.classList.add("doc-section-title");
  });

  root.querySelectorAll("h3").forEach((node) => {
    node.classList.add("doc-subsection-title");
  });

  convertNumberedParagraphsToList(root);
  mergeAdjacentOrderedLists(root);

  return root.innerHTML || "<p></p>";
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[16px] w-[16px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[16px] w-[16px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M8 17h2a1.5 1.5 0 0 0 0-3H8v5" />
      <path d="M13 19v-5h1.5a2.5 2.5 0 0 1 0 5H13" />
      <path d="M18 14h-2.5v5" />
      <path d="M15.5 16.5H17.5" />
    </svg>
  );
}

function WordIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[16px] w-[16px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="m8 14 1.2 5 1.8-5 1.8 5 1.2-5" />
    </svg>
  );
}

function stripHtmlToPlainText(html: string) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

function looksLikeSystemTitle(value: string) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return true;

  return (
    v === "new chat" ||
    v === "untitled draft" ||
    v === "frontend-lawsuit" ||
    v === "frontend_lawsuit" ||
    v === "frontend lawsuit" ||
    /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(v)
  );
}

function deriveReadableTitle({
  conversationTitle,
  draftingObjective,
  draftText,
}: {
  conversationTitle: string;
  draftingObjective: string;
  draftText: string;
}) {
  const cleanConversationTitle = String(conversationTitle || "").trim();
  if (cleanConversationTitle && !looksLikeSystemTitle(cleanConversationTitle)) {
    return cleanConversationTitle;
  }

  const cleanObjective = String(draftingObjective || "").trim();
  if (cleanObjective) {
    return cleanObjective.length > 80
      ? `${cleanObjective.slice(0, 77).trim()}...`
      : cleanObjective;
  }

  const plainDraft = stripHtmlToPlainText(
    looksLikeHtml(draftText) ? extractDocBody(draftText) : draftText
  );

  if (plainDraft) {
    return plainDraft.length > 80
      ? `${plainDraft.slice(0, 77).trim()}...`
      : plainDraft;
  }

  return "Untitled draft";
}

export default function DraftingDock({
  conversationTitle,
  draftText,
  draftDocumentId: _draftDocumentId,
  draftingObjective,
  draftingSources: _draftingSources,
  onDraftChange,
  onClose,
  branding,
}: DraftingDockProps) {
  const editorRef = useRef<TinyMCEEditorType | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const editorAreaRef = useRef<HTMLDivElement | null>(null);

  const [docTitle, setDocTitle] = useState(conversationTitle || "Untitled draft");
  const [editorHtml, setEditorHtml] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [editorHeight, setEditorHeight] = useState(640);

  const lastExternalBodyRef = useRef("");
  const lastBrandingSignatureRef = useRef("");

  const brandingSignature = JSON.stringify({
    mode: branding?.mode || "none",
    headerImageUrl: branding?.headerImageUrl || "",
    footerImageUrl: branding?.footerImageUrl || "",
    letterheadImageUrl: branding?.letterheadImageUrl || "",
    signatureImageUrl: branding?.signatureImageUrl || "",
    headerHeightPx: branding?.headerHeightPx || 110,
    footerHeightPx: branding?.footerHeightPx || 90,
    letterheadHeightPx: branding?.letterheadHeightPx || 130,
    lockBranding: branding?.lockBranding !== false,
  });


useEffect(() => {
  setDocTitle(
    deriveReadableTitle({
      conversationTitle,
      draftingObjective,
      draftText,
    })
  );
}, [conversationTitle, draftingObjective, draftText]);

  useEffect(() => {
    const measure = () => {
      const host = editorAreaRef.current;
      if (!host) return;

      const nextHeight = Math.max(420, Math.floor(host.getBoundingClientRect().height));
      setEditorHeight(nextHeight);

      if (editorRef.current) {
        requestAnimationFrame(() => {
          applyEditorLayout(editorRef.current!, nextHeight);
        });
      }
    };

    measure();

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        measure();
      });

      if (shellRef.current) resizeObserver.observe(shellRef.current);
      if (editorAreaRef.current) resizeObserver.observe(editorAreaRef.current);
    }

    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const rawBodyHtml = looksLikeHtml(draftText)
      ? extractDocBody(draftText)
      : markdownishTextToHtml(draftText);

    const incomingBodyHtml = applyDraftPreset(rawBodyHtml);

    const brandingChanged =
      brandingSignature !== lastBrandingSignatureRef.current;
    const bodyChanged = incomingBodyHtml !== lastExternalBodyRef.current;

    if (!brandingChanged && !bodyChanged) {
      applyEditorLayout(editor, editorHeight);
      return;
    }

    const rebuilt = buildEditorDocument(incomingBodyHtml, branding);

    lastExternalBodyRef.current = incomingBodyHtml;
    lastBrandingSignatureRef.current = brandingSignature;
    setEditorHtml(rebuilt);

    editor.setContent(rebuilt);
    applyEditorLayout(editor, editorHeight);
  }, [draftText, branding, brandingSignature, editorHeight]);

  const currentBodyHtml = useMemo(() => {
    return (
      extractDocBody(editorRef.current?.getContent({ format: "html" }) || "") ||
      extractDocBody(editorHtml) ||
      (looksLikeHtml(draftText)
        ? extractDocBody(draftText)
        : markdownishTextToHtml(draftText))
    );
  }, [editorHtml, draftText]);

  const brandingLabel =
    branding?.mode === "letterhead"
      ? "Letterhead branding"
      : branding?.mode === "header_footer"
      ? "Header + Footer branding"
      : "No branding";

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);

      const exportBranding = await inlineBrandingImages(branding);

      const response = await fetch("/api/drafting/export/pdf", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: docTitle || "Draft",
          bodyHtml: currentBodyHtml,
          branding: exportBranding || null,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to export PDF.");
      }

      const blob = await response.blob();
      downloadBlob(blob, `${safeFileName(docTitle || "Draft")}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };



const handleExportDocx = async () => {
  try {
    setExportingDocx(true);

    const exportBranding = await inlineBrandingImages(branding);

    const response = await fetch("/api/drafting/export/docx", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: docTitle || "Draft",
        bodyHtml: currentBodyHtml,
        branding: exportBranding || null,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || "Failed to export DOCX.");
    }

    const blob = await response.blob();
    downloadBlob(blob, `${safeFileName(docTitle || "Draft")}.docx`);
  } catch (error) {
    console.error("DOCX export failed", error);
    throw error;
  } finally {
    setExportingDocx(false);
  }
};

  return (
    <section
      ref={shellRef}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white"
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[980px] flex-col bg-white">
        <div className="shrink-0 bg-blue-50 px-4 py-4 backdrop-blur draft-head sm:px-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer shrink-0 flex h-9 w-9 items-center justify-center rounded-[6px] bg-white text-slate-600 transition hover:bg-slate-100"
                  aria-label="Close drafting panel"
                  title="Close drafting panel"
                >
                  <CloseIcon />
                </button>
              ) : null}

              <div className="min-w-0 flex-1">
                <input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  title={docTitle}
                  className="w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-0 bg-transparent p-0 pr-2 text-[18px] font-semibold text-[#114C8D] outline-none"
                />

                <div className="mt-1 flex min-w-0 items-center gap-x-3 gap-y-1 overflow-hidden text-xs text-slate-500">
                  <span
                    title={brandingLabel}
                    className="max-w-[140px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    {brandingLabel}
                  </span>

                  {draftingObjective ? (
                    <span
                      title={draftingObjective}
                      className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                      • {draftingObjective}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                title="Export PDF"
                onClick={handleExportPdf}
                disabled={exportingPdf || exportingDocx}
                className="cursor-pointer inline-flex items-center gap-2 rounded-[6px] border border-[#d7e6f7] bg-white px-3 py-2 text-sm font-medium text-[#114C8D] transition hover:bg-[#f4f9ff] disabled:opacity-60"
              >
                <PdfIcon />
                <span>{exportingPdf ? "Exporting PDF..." : "PDF"}</span>
              </button>
              <button
                type="button"
                title="Export Word"
                onClick={handleExportDocx}
                disabled={exportingPdf || exportingDocx}
                className="cursor-pointer inline-flex items-center gap-2 rounded-[6px] border border-[#d7e6f7] bg-white px-3 py-2 text-sm font-medium text-[#114C8D] transition hover:bg-[#f4f9ff] disabled:opacity-60"
              >
                <WordIcon />
                <span>{exportingDocx ? "Exporting DOCX..." : "DOCX"}</span>
              </button>
            </div>
          </div>
        </div>

        <div
          ref={editorAreaRef}
          className="min-h-0 flex-1 overflow-hidden p-[0px] sm:p-[0px]"
        >
          <Editor
            licenseKey="gpl"
            onInit={(_, editor) => {
              editorRef.current = editor;

              const rawInitialBody = looksLikeHtml(draftText)
                ? extractDocBody(draftText)
                : markdownishTextToHtml(draftText);

              const initialBody = applyDraftPreset(rawInitialBody);
              const initialFull = buildEditorDocument(initialBody, branding);

              lastExternalBodyRef.current = initialBody;
              lastBrandingSignatureRef.current = brandingSignature;
              setEditorHtml(initialFull);

              requestAnimationFrame(() => {
                editor.setContent(initialFull);

                const host = editorAreaRef.current;
                const measuredHeight = host
                  ? Math.max(420, Math.floor(host.getBoundingClientRect().height))
                  : editorHeight;

                applyEditorLayout(editor, measuredHeight);
              });
            }}
            init={{
              height: editorHeight,
              min_height: editorHeight,
              highlight_on_focus: false,
              menubar: false,
              branding: false,
              promotion: false,
              statusbar: true,
              resize: false,
              toolbar_sticky: false,
              lists_indent_on_tab: true,
              advlist_bullet_styles: "default,circle,square",
              advlist_number_styles: "default,lower-alpha,lower-roman,upper-alpha,upper-roman",
              forced_root_block: "p",
              toolbar_mode: "floating",
              contextmenu:
                "undo redo | inserttable | cell row column deletetable | link",
              plugins: [
                "advlist",
                "autolink",
                "lists",
                "link",
                "image",
                "charmap",
                "anchor",
                "searchreplace",
                "visualblocks",
                "code",
                "insertdatetime",
                "media",
                "table",
                "wordcount",
                "quickbars",
                "pagebreak",
                "nonbreaking",
              ],
              toolbar:
                "undo redo | styles blocks fontfamily fontsize lineheight | formatting alignment lists insert | code",
              toolbar_groups: {
                formatting: {
                  icon: "bold",
                  tooltip: "Formatting",
                  items:
                    "bold italic underline strikethrough | forecolor backcolor | removeformat",
                },
                alignment: {
                  icon: "align-left",
                  tooltip: "Alignment",
                  items: "alignleft aligncenter alignright alignjustify",
                },
                lists: {
                  icon: "unordered-list",
                  tooltip: "Lists",
                  items: "bullist numlist | outdent indent",
                },
                insert: {
                  icon: "insert-time",
                  tooltip: "Insert",
                  items:
                    "link openlink unlink anchor | table image media | pagebreak nonbreaking",
                },
              },
              style_formats: [
                {
                  title: "Document Title",
                  block: "h1",
                  classes: "doc-title",
                },
                {
                  title: "Section Heading",
                  block: "h2",
                  classes: "doc-section-title",
                },
                {
                  title: "Subsection Heading",
                  block: "h3",
                  classes: "doc-subsection-title",
                },
              ],
              style_formats_merge: true,
              quickbars_selection_toolbar:
                "bold italic underline strikethrough | quicklink blockquote | bullist numlist | removeformat",
              quickbars_insert_toolbar:
                "quicktable quickimage | hr pagebreak",
              link_context_toolbar: true,
              table_toolbar:
                "tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | mergecells splitcells",
              font_size_formats:
                "10pt 11pt 12pt 13pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt",
              font_size_input_default_unit: "pt",
              line_height_formats: "1 1.15 1.3 1.45 1.6 1.8 2",
              font_family_formats:
                "Times New Roman=times new roman,times,serif;" +
                "Arial=arial,helvetica,sans-serif;" +
                "Calibri=calibri,arial,sans-serif;" +
                "Georgia=georgia,serif;" +
                "Garamond=garamond,serif;" +
                "Verdana=verdana,geneva,sans-serif;" +
                "Courier New=courier new,courier,monospace",
              block_formats:
                "Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Blockquote=blockquote; Preformatted=pre",
              noneditable_noneditable_class: "mceNonEditable",
              setup: (editor) => {
                editor.on("init", () => {
                  const host = editorAreaRef.current;
                  const measuredHeight = host
                    ? Math.max(420, Math.floor(host.getBoundingClientRect().height))
                    : editorHeight;

                  applyEditorLayout(editor, measuredHeight);
                });
              },
              content_style: DRAFT_EDITOR_CSS,
            }}
            onEditorChange={(content) => {
              setEditorHtml(content);

              const bodyOnly = extractDocBody(content);
              lastExternalBodyRef.current = bodyOnly;
              onDraftChange?.(bodyOnly);
            }}
          />
        </div>
      </div>
    </section>
  );
}