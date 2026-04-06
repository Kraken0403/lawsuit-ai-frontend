import { apiRequest } from "../lib/api";

export type DraftBrandingMode = "NONE" | "HEADER_FOOTER" | "LETTERHEAD";
export type DraftingAssetKind =
  | "header"
  | "footer"
  | "letterhead"
  | "signature";

export type DraftingSettings = {
  firmName: string;
  advocateName: string;
  enrollmentNumber: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
  headerText: string;
  footerText: string;
  signatureText: string;

  draftingBrandingMode: DraftBrandingMode;
  draftingHeaderImageUrl: string;
  draftingFooterImageUrl: string;
  draftingLetterheadImageUrl: string;
  draftingSignatureImageUrl: string;

  draftingHeaderHeightPx: number;
  draftingFooterHeightPx: number;
  draftingLetterheadHeightPx: number;

  draftingLockBranding: boolean;

  draftingDefaultTone: string;
  draftingDefaultJurisdiction: string;
  draftingDefaultForum: string;
};

type DraftingSettingsApiResponse = {
  ok: boolean;
  settings?: unknown;
};

type DraftingAssetUploadApiResponse = {
  ok: boolean;
  url?: string;
  assetUrl?: string;
  fileUrl?: string;
  path?: string;
  settings?: unknown;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(
  /\/+$/,
  ""
);

export const EMPTY_DRAFTING_SETTINGS: DraftingSettings = {
  firmName: "",
  advocateName: "",
  enrollmentNumber: "",
  address: "",
  email: "",
  phone: "",
  website: "",
  logoUrl: "",
  headerText: "",
  footerText: "",
  signatureText: "",

  draftingBrandingMode: "NONE",
  draftingHeaderImageUrl: "",
  draftingFooterImageUrl: "",
  draftingLetterheadImageUrl: "",
  draftingSignatureImageUrl: "",

  draftingHeaderHeightPx: 110,
  draftingFooterHeightPx: 90,
  draftingLetterheadHeightPx: 130,

  draftingLockBranding: true,

  draftingDefaultTone: "",
  draftingDefaultJurisdiction: "",
  draftingDefaultForum: "",
};

function normalizeMode(value: unknown): DraftBrandingMode {
  const normalized = String(value || "").trim().toUpperCase();

  if (
    normalized === "NONE" ||
    normalized === "HEADER_FOOTER" ||
    normalized === "LETTERHEAD"
  ) {
    return normalized as DraftBrandingMode;
  }

  return "NONE";
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeUrl(value: unknown) {
  const raw = String(value || "")
    .trim()
    .replace(/\\/g, "/");

  if (!raw) return "";

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("blob:") ||
    raw.startsWith("data:")
  ) {
    return raw;
  }

  if (raw.startsWith("//")) {
    return `${window.location.protocol}${raw}`;
  }

  if (raw.startsWith("/")) {
    return `${API_BASE}${raw}`;
  }

  return `${API_BASE}/${raw.replace(/^\/+/, "")}`;
}

function normalizeSettings(raw: any): DraftingSettings {
  return {
    ...EMPTY_DRAFTING_SETTINGS,

    firmName: String(raw?.firmName || ""),
    advocateName: String(raw?.advocateName || ""),
    enrollmentNumber: String(raw?.enrollmentNumber || ""),
    address: String(raw?.address || ""),
    email: String(raw?.email || ""),
    phone: String(raw?.phone || ""),
    website: String(raw?.website || ""),
    logoUrl: normalizeUrl(raw?.logoUrl),
    headerText: String(raw?.headerText || ""),
    footerText: String(raw?.footerText || ""),
    signatureText: String(raw?.signatureText || ""),

    draftingBrandingMode: normalizeMode(raw?.draftingBrandingMode),
    draftingHeaderImageUrl: normalizeUrl(raw?.draftingHeaderImageUrl),
    draftingFooterImageUrl: normalizeUrl(raw?.draftingFooterImageUrl),
    draftingLetterheadImageUrl: normalizeUrl(raw?.draftingLetterheadImageUrl),
    draftingSignatureImageUrl: normalizeUrl(raw?.draftingSignatureImageUrl),

    draftingHeaderHeightPx: normalizeNumber(raw?.draftingHeaderHeightPx, 110),
    draftingFooterHeightPx: normalizeNumber(raw?.draftingFooterHeightPx, 90),
    draftingLetterheadHeightPx: normalizeNumber(
      raw?.draftingLetterheadHeightPx,
      130
    ),

    draftingLockBranding:
      typeof raw?.draftingLockBranding === "boolean"
        ? raw.draftingLockBranding
        : true,

    draftingDefaultTone: String(raw?.draftingDefaultTone || ""),
    draftingDefaultJurisdiction: String(
      raw?.draftingDefaultJurisdiction || ""
    ),
    draftingDefaultForum: String(raw?.draftingDefaultForum || ""),
  };
}

export const draftingSettingsService = {
  async getSettings() {
    const data = await apiRequest<DraftingSettingsApiResponse>(
      "/api/drafting/settings",
      {
        method: "GET",
      }
    );

    return {
      ok: true,
      settings: normalizeSettings(data?.settings || {}),
    };
  },

  async saveSettings(payload: Partial<DraftingSettings>) {
    const data = await apiRequest<DraftingSettingsApiResponse>(
      "/api/drafting/settings",
      {
        method: "PUT",
        body: payload,
      }
    );

    return {
      ok: true,
      settings: normalizeSettings(data?.settings || {}),
    };
  },

  async uploadAsset(kind: DraftingAssetKind, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const data = await apiRequest<DraftingAssetUploadApiResponse>(
      `/api/drafting/settings/assets/${kind}`,
      {
        method: "POST",
        body: formData,
      }
    );

    return {
      ok: true,
      kind,
      url: normalizeUrl(
        data?.url || data?.assetUrl || data?.fileUrl || data?.path || ""
      ),
      settings: normalizeSettings(data?.settings || {}),
    };
  },

  async deleteAsset(kind: DraftingAssetKind) {
    const data = await apiRequest<DraftingSettingsApiResponse>(
      `/api/drafting/settings/assets/${kind}`,
      {
        method: "DELETE",
      }
    );

    return {
      ok: true,
      kind,
      settings: normalizeSettings(data?.settings || {}),
    };
  },
};