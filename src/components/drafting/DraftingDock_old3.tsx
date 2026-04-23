import { useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyMCEEditorType } from "tinymce";

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
import { inlineBrandingImages } from "./draftingExport";
import {
  downloadBlob,
  extractDocBody,
  looksLikeHtml,
  markdownishTextToHtml,
  safeFileName,
  stripOuterMarkdownFence,
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
  draftPlaceholderValues?: Record<string, string>;
  onDraftChange?: (html: string) => void;
  onClose?: () => void;
  onFillPlaceholders?: (values: Record<string, string>) => Promise<void> | void;
  onPlaceholderApplied?: (message: string) => void;
  branding?: DraftBrandingSettings;
};

const DEFAULT_FONT_STACK = "'Times New Roman', Times, serif";
const EMPTY_STRING_RECORD: Record<string, string> = Object.freeze({});

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

  .doc-placeholder-applied {
    background: #fff3a3;
    border-radius: 3px;
    padding: 0 1px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
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

function isEffectivelyEmptyNode(node: HTMLElement | null) {
  if (!node) return false;
  if (!["P", "DIV"].includes(node.tagName)) return false;

  const html = (node.innerHTML || "")
    .replace(/&nbsp;/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "")
    .trim();

  return !html && !(node.textContent || "").trim();
}

function mergeAdjacentOrderedLists(root: HTMLElement) {
  let children = Array.from(root.children) as HTMLElement[];
  let index = 0;

  while (index < children.length - 1) {
    const current = children[index];
    const next = children[index + 1];

    if (!current || !next) {
      index += 1;
      continue;
    }

    if (current.tagName === "OL" && next.tagName === "OL") {
      while (next.firstChild) {
        current.appendChild(next.firstChild);
      }
      next.remove();
      children = Array.from(root.children) as HTMLElement[];
      continue;
    }

    const bridge = children[index + 1];
    const afterBridge = children[index + 2];

    if (
      current.tagName === "OL" &&
      isEffectivelyEmptyNode(bridge) &&
      afterBridge?.tagName === "OL"
    ) {
      while (afterBridge.firstChild) {
        current.appendChild(afterBridge.firstChild);
      }
      bridge.remove();
      afterBridge.remove();
      children = Array.from(root.children) as HTMLElement[];
      continue;
    }

    index += 1;
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

function isJunkTitleCandidate(value: string) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return true;

  return (
    /^```/.test(clean) ||
    clean === "markdown" ||
    clean === "md" ||
    clean === "text" ||
    clean === "plaintext" ||
    clean === "plain text"
  );
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
      !isJunkTitleCandidate(firstText) &&
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

function normalizeDockTitle(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripSubjectPrefixLocal(value: unknown) {
  return normalizeDockTitle(value).replace(/^subject\s*[:\-]\s*/i, "").trim();
}

function countBracketPlaceholdersLocal(value: string) {
  return (String(value || "").match(/\[[^\]]+\]/g) || []).length;
}

function looksLikeAddressOrScaffoldTitle(value: string) {
  const v = normalizeDockTitle(value).toLowerCase();
  if (!v) return true;

  const scaffoldPhrases = [
    "your name",
    "your company",
    "your address",
    "sender name",
    "sender company",
    "sender address",
    "recipient name",
    "recipient company",
    "recipient address",
    "company name",
    "city, state",
    "zip code",
    "pin code",
    "email address",
    "phone number",
    "mobile number",
    "invoice number",
    "invoice date",
    "due date",
    "amount due",
    "insert date",
    "sir/madam",
  ];

  if (
    v === "new chat" ||
    v === "untitled draft" ||
    v === "frontend-lawsuit" ||
    v === "frontend_lawsuit" ||
    v === "frontend lawsuit" ||
    /^```/.test(v) ||
    /^markdown$/i.test(v)
  ) {
    return true;
  }

  if (
    /^to[,]?$/.test(v) ||
    /^dear\b/.test(v) ||
    /^date\s*[:\-]/.test(v)
  ) {
    return true;
  }

  if (scaffoldPhrases.some((phrase) => v.includes(phrase))) {
    return true;
  }

  if (countBracketPlaceholdersLocal(v) >= 2) {
    return true;
  }

  return false;
}

function deriveReadableTitle({
  conversationTitle,
  draftingObjective,
  draftingExtractedFacts,
  draftText,
}: {
  conversationTitle: string;
  draftingObjective: string;
  draftingExtractedFacts: Record<string, unknown>;
  draftText: string;
}) {
  const factCandidates = [
    draftingExtractedFacts?.subject,
    draftingExtractedFacts?.core_request_or_purpose,
    draftingExtractedFacts?.what_you_want_the_document_to_achieve,
    draftingExtractedFacts?.grievance_or_default,
    draftingExtractedFacts?.demands,
  ]
    .map((item) => stripSubjectPrefixLocal(item))
    .filter(Boolean);

  for (const candidate of factCandidates) {
    if (!looksLikeAddressOrScaffoldTitle(candidate)) {
      const cleaned = stripSubjectPrefixLocal(candidate);
      return cleaned.length > 100
        ? `${cleaned.slice(0, 97).trim()}...`
        : cleaned;
    }
  }

  const plainDraft = stripHtmlToPlainText(
    looksLikeHtml(draftText)
      ? extractDocBody(draftText)
      : stripOuterMarkdownFence(draftText)
  );

  const draftLines = plainDraft
    .split(/\r?\n/)
    .map((line) => normalizeDockTitle(line))
    .filter(Boolean);

  const subjectLine = draftLines
    .map((line) => stripSubjectPrefixLocal(line))
    .find((line) => line && !looksLikeAddressOrScaffoldTitle(line));

  if (subjectLine) {
    const cleaned = stripSubjectPrefixLocal(subjectLine);
    return cleaned.length > 100
      ? `${cleaned.slice(0, 97).trim()}...`
      : cleaned;
  }

  const cleanConversationTitle = stripSubjectPrefixLocal(
    normalizeDockTitle(conversationTitle)
  );
  if (
    cleanConversationTitle &&
    !looksLikeAddressOrScaffoldTitle(cleanConversationTitle)
  ) {
    return cleanConversationTitle.length > 100
      ? `${cleanConversationTitle.slice(0, 97).trim()}...`
      : cleanConversationTitle;
  }

  const cleanObjective = stripSubjectPrefixLocal(draftingObjective);
  if (cleanObjective && !looksLikeAddressOrScaffoldTitle(cleanObjective)) {
    return cleanObjective.length > 100
      ? `${cleanObjective.slice(0, 97).trim()}...`
      : cleanObjective;
  }

  for (const line of draftLines.slice(0, 8)) {
    const cleaned = stripSubjectPrefixLocal(line);
    if (!looksLikeAddressOrScaffoldTitle(cleaned)) {
      return cleaned.length > 100
        ? `${cleaned.slice(0, 97).trim()}...`
        : cleaned;
    }
  }

  return "Untitled draft";
}

function formatPlaceholderLabel(key: string) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferPlaceholderInputType(key: string) {
  const value = String(key || "").toLowerCase();

  if (/(^|_)(date|dob|day|month|year)(_|$)/.test(value)) return "date";
  if (/(^|_)(amount|price|value|fee|cost|sum|total)(_|$)/.test(value))
    return "number";
  if (/(^|_)(email|mail)(_|$)/.test(value)) return "email";
  if (/(^|_)(phone|mobile|contact|whatsapp|tel)(_|$)/.test(value))
    return "tel";

  return "text";
}

function areStringRecordsEqual(
  a: Record<string, string>,
  b: Record<string, string>
) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (String(a[key] || "") !== String(b[key] || "")) {
      return false;
    }
  }

  return true;
}

function buildPlaceholderStorageKey(params: {
  draftDocumentId: string | null;
  conversationTitle: string;
  draftingObjective: string;
}) {
  if (params.draftDocumentId) {
    return `lawsuit:draft-placeholders:${params.draftDocumentId}`;
  }

  const fallbackBase =
    params.conversationTitle?.trim() ||
    params.draftingObjective?.trim() ||
    "unsaved-draft";

  return `lawsuit:draft-placeholders:${fallbackBase}`;
}

function normalizePlaceholderKey(value: unknown) {
  return String(value ?? "")
    .replace(/^\[|\]$/g, "")
    .replace(/[_\s]+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim()
    .toLowerCase();
}

function extractBracketPlaceholderKeysFromText(value: string) {
  const normalized = stripHtmlToPlainText(
    looksLikeHtml(value) ? extractDocBody(value) : stripOuterMarkdownFence(value)
  );

  const matches = normalized.match(/\[[^\]]+\]/g) || [];
  const seen = new Set<string>();

  for (const match of matches) {
    const key = String(match).slice(1, -1).trim();
    if (!key) continue;
    seen.add(key);
  }

  return Array.from(seen);
}

function escapeHtmlLocal(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replacePlaceholderTokensInHtml(
  html: string,
  values: Record<string, string>,
  options?: { highlight?: boolean }
) {
  const safeHtml = html?.trim() ? html : "<p></p>";
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div id="placeholder-root">${safeHtml}</div>`,
    "text/html"
  );
  const root = doc.getElementById("placeholder-root");

  if (!root) return safeHtml;

  const normalizedEntries = Object.entries(values)
    .map(([key, value]) => [
      normalizePlaceholderKey(key),
      String(value || "").trim(),
    ] as const)
    .filter(([key, value]) => key && value);

  if (!normalizedEntries.length) {
    return safeHtml;
  }

  const valueMap = new Map<string, string>(normalizedEntries);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  const tokenRegex = /\[([^\]]+)\]/g;

  for (const node of textNodes) {
    const sourceText = node.nodeValue || "";
    if (!sourceText.includes("[")) continue;

    tokenRegex.lastIndex = 0;
    const matches = Array.from(sourceText.matchAll(tokenRegex));
    if (!matches.length) continue;

    let lastIndex = 0;
    let replacedAny = false;
    const fragment = doc.createDocumentFragment();

    for (const match of matches) {
      const fullMatch = match[0] || "";
      const rawKey = match[1] || "";
      const normalizedKey = normalizePlaceholderKey(rawKey);
      const replacementValue = valueMap.get(normalizedKey);

      if (!replacementValue) {
        continue;
      }

      const matchIndex = match.index ?? 0;
      if (matchIndex > lastIndex) {
        fragment.appendChild(
          doc.createTextNode(sourceText.slice(lastIndex, matchIndex))
        );
      }

      if (options?.highlight) {
        const span = doc.createElement("span");
        span.className = "doc-placeholder-applied";
        span.setAttribute("data-placeholder-filled", normalizedKey);
        span.innerHTML = escapeHtmlLocal(replacementValue);
        fragment.appendChild(span);
      } else {
        fragment.appendChild(doc.createTextNode(replacementValue));
      }

      lastIndex = matchIndex + fullMatch.length;
      replacedAny = true;
    }

    if (!replacedAny) continue;

    if (lastIndex < sourceText.length) {
      fragment.appendChild(doc.createTextNode(sourceText.slice(lastIndex)));
    }

    node.parentNode?.replaceChild(fragment, node);
  }

  return root.innerHTML || safeHtml;
}

export default function DraftingDock({
  conversationTitle,
  draftText,
  draftDocumentId,
  draftingAnswerType: _draftingAnswerType,
  draftingObjective,
  draftingSources: _draftingSources,
  draftingMissingFields: _draftingMissingFields,
  draftingExtractedFacts,
  draftPlaceholderValues = EMPTY_STRING_RECORD,
  onDraftChange,
  onClose,
  onFillPlaceholders,
  onPlaceholderApplied,
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
  const [isPlaceholderDrawerOpen, setIsPlaceholderDrawerOpen] = useState(false);
  const [placeholderFormValues, setPlaceholderFormValues] = useState<Record<string, string>>({});
  const [savingPlaceholders, setSavingPlaceholders] = useState(false);
  const [placeholderNotice, setPlaceholderNotice] = useState("");

  const lastExternalBodyRef = useRef("");
  const lastBrandingSignatureRef = useRef("");
  const isApplyingExternalContentRef = useRef(false);

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

  const normalizedDraftPlaceholderValues = useMemo(() => {
    return Object.fromEntries(
      Object.entries(draftPlaceholderValues || EMPTY_STRING_RECORD)
        .map(([key, value]) => [String(key || "").trim(), String(value || "")])
        .filter(([key]) => key)
    ) as Record<string, string>;
  }, [JSON.stringify(draftPlaceholderValues || EMPTY_STRING_RECORD)]);

  const placeholderKeys = useMemo(() => {
    const sourceText = editorHtml || draftText;
    const keys = extractBracketPlaceholderKeysFromText(sourceText).filter(
      (key) => String(key || "").trim()
    );

    return Array.from(new Set(keys));
  }, [editorHtml, draftText]);

  const placeholderStorageKey = useMemo(
    () =>
      buildPlaceholderStorageKey({
        draftDocumentId,
        conversationTitle,
        draftingObjective,
      }),
    [draftDocumentId, conversationTitle, draftingObjective]
  );

  const placeholderKeysSignature = useMemo(
    () => JSON.stringify([...placeholderKeys].sort()),
    [placeholderKeys]
  );

  const draftPlaceholderValuesSignature = useMemo(
    () => JSON.stringify(normalizedDraftPlaceholderValues),
    [normalizedDraftPlaceholderValues]
  );

  const hasAnyPlaceholderValue = useMemo(
    () =>
      Object.values(placeholderFormValues).some((value) =>
        String(value || "").trim()
      ),
    [placeholderFormValues]
  );

  const canApplyPlaceholderValues = !savingPlaceholders && hasAnyPlaceholderValue;

  useEffect(() => {
    const nextTitle = deriveReadableTitle({
      conversationTitle,
      draftingObjective,
      draftingExtractedFacts,
      draftText,
    });

    const normalizedNext = stripSubjectPrefixLocal(nextTitle) || "Untitled draft";

    setDocTitle((prev) => (prev === normalizedNext ? prev : normalizedNext));
  }, [conversationTitle, draftingObjective, draftingExtractedFacts, draftText]);

  useEffect(() => {
    let storedValues: Record<string, string> = {};

    try {
      const raw = localStorage.getItem(placeholderStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          storedValues = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
              key,
              String(value || ""),
            ])
          );
        }
      }
    } catch (error) {
      console.warn("Failed to load stored placeholder values", error);
    }

    setPlaceholderFormValues((prev) => {
      const next: Record<string, string> = {};

      for (const key of placeholderKeys) {
        const incomingValue = normalizedDraftPlaceholderValues[key];
        const prevValue = prev?.[key];
        const storedValue = storedValues?.[key];

        next[key] =
          typeof incomingValue !== "undefined"
            ? String(incomingValue || "")
            : typeof prevValue !== "undefined"
            ? String(prevValue || "")
            : typeof storedValue !== "undefined"
            ? String(storedValue || "")
            : "";
      }

      return areStringRecordsEqual(prev, next) ? prev : next;
    });
  }, [
    placeholderStorageKey,
    placeholderKeysSignature,
    draftPlaceholderValuesSignature,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(
        placeholderStorageKey,
        JSON.stringify(placeholderFormValues)
      );
    } catch (error) {
      console.warn("Failed to persist placeholder values", error);
    }
  }, [placeholderStorageKey, placeholderFormValues]);

  useEffect(() => {
    const measure = () => {
      const host = editorAreaRef.current;
      if (!host) return;

      const nextHeight = Math.max(
        420,
        Math.floor(host.getBoundingClientRect().height)
      );
      setEditorHeight((prev) => (prev === nextHeight ? prev : nextHeight));

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

    const brandingChanged = brandingSignature !== lastBrandingSignatureRef.current;
    const bodyChanged = incomingBodyHtml !== lastExternalBodyRef.current;

    if (!brandingChanged && !bodyChanged) {
      applyEditorLayout(editor, editorHeight);
      return;
    }

    const rebuilt = buildEditorDocument(incomingBodyHtml, branding);

    lastExternalBodyRef.current = incomingBodyHtml;
    lastBrandingSignatureRef.current = brandingSignature;
    setEditorHtml(rebuilt);

    isApplyingExternalContentRef.current = true;
    editor.setContent(rebuilt);
    requestAnimationFrame(() => {
      isApplyingExternalContentRef.current = false;
      applyEditorLayout(editor, editorHeight);
    });
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

  const handlePlaceholderSubmit = async () => {
    const cleanedValues = Object.fromEntries(
      Object.entries(placeholderFormValues).filter(([, value]) =>
        String(value || "").trim()
      )
    ) as Record<string, string>;

    if (!Object.keys(cleanedValues).length) return;

    try {
      setSavingPlaceholders(true);
      setPlaceholderNotice("");

      const latestBodyHtml =
        extractDocBody(editorRef.current?.getContent({ format: "html" }) || "") ||
        currentBodyHtml ||
        "<p></p>";

      const replacedBodyHtml = replacePlaceholderTokensInHtml(
        latestBodyHtml,
        cleanedValues
      );
      const highlightedBodyHtml = replacePlaceholderTokensInHtml(
        latestBodyHtml,
        cleanedValues,
        { highlight: true }
      );

      const rebuilt = buildEditorDocument(highlightedBodyHtml, branding);

      lastExternalBodyRef.current = replacedBodyHtml;
      lastBrandingSignatureRef.current = brandingSignature;
      setEditorHtml(rebuilt);

      if (editorRef.current) {
        isApplyingExternalContentRef.current = true;
        editorRef.current.setContent(rebuilt);
        requestAnimationFrame(() => {
          isApplyingExternalContentRef.current = false;
          if (editorRef.current) {
            applyEditorLayout(editorRef.current, editorHeight);
          }
        });
      }

      onDraftChange?.(replacedBodyHtml);

      if (onFillPlaceholders) {
        await onFillPlaceholders(cleanedValues);
      }

      setIsPlaceholderDrawerOpen(false);
      setPlaceholderNotice("Placeholders applied successfully.");
      onPlaceholderApplied?.("Placeholders applied successfully.");
    } finally {
      setSavingPlaceholders(false);
    }
  };

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
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white"
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
              {placeholderKeys.length > 0 ? (
                <button
                  type="button"
                  title="Fill placeholders"
                  onClick={() => setIsPlaceholderDrawerOpen(true)}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-[6px] border border-[#d7e6f7] bg-white px-3 py-2 text-sm font-medium text-[#114C8D] transition hover:bg-[#f4f9ff]"
                >
                  <span>Placeholders</span>
                  <span className="rounded-full bg-[#eef5ff] px-2 py-0.5 text-xs font-semibold text-[#114C8D]">
                    {placeholderKeys.length}
                  </span>
                </button>
              ) : null}

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
                isApplyingExternalContentRef.current = true;
                editor.setContent(initialFull);

                const host = editorAreaRef.current;
                const measuredHeight = host
                  ? Math.max(420, Math.floor(host.getBoundingClientRect().height))
                  : editorHeight;

                applyEditorLayout(editor, measuredHeight);
                requestAnimationFrame(() => {
                  isApplyingExternalContentRef.current = false;
                });
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
              advlist_number_styles:
                "default,lower-alpha,lower-roman,upper-alpha,upper-roman",
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

              if (isApplyingExternalContentRef.current) {
                return;
              }

              onDraftChange?.(bodyOnly);
            }}
          />
        </div>
      </div>

      {isPlaceholderDrawerOpen ? (
        <>
          <div
            className="absolute inset-0 z-20 bg-slate-900/20"
            onClick={() => setIsPlaceholderDrawerOpen(false)}
          />
          <aside className="absolute right-0 top-0 z-30 flex h-full w-full max-w-[360px] flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Fill placeholders
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Update the draft by replacing the remaining fields.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlaceholderDrawerOpen(false)}
                className="cursor-pointer rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close placeholders drawer"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {placeholderKeys.map((key) => {
                const inputType = inferPlaceholderInputType(key);

                return (
                  <label key={key} className="block">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      {formatPlaceholderLabel(key)}
                    </span>

                    <span className="mb-2 block text-[11px] font-mono text-slate-400">
                      [{key}]
                    </span>

                    <input
                      type={inputType}
                      value={placeholderFormValues[key] || ""}
                      onChange={(event) =>
                        setPlaceholderFormValues((prev) => ({
                          ...prev,
                          [key]: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#9ac2ff] focus:ring-2 focus:ring-[#dbeafe]"
                      placeholder={`[${key}]`}
                    />
                  </label>
                );
              })}
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              {placeholderNotice ? (
                <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {placeholderNotice}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handlePlaceholderSubmit}
                disabled={!canApplyPlaceholderValues}
                className="cursor-pointer inline-flex w-full items-center justify-center rounded-xl bg-[#114C8D] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0e3f75] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPlaceholders ? "Updating draft..." : "Apply values"}
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}


