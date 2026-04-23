export type AllowedCourtOption = {
  id: number;
  groupId?: number | null;
  title?: string | null;
  subtitle?: string | null;
  label: string;
};

const COURT_LABELS_BY_SUBID: Record<number, string> = {
  1: "Supreme Court",
  2: "Delhi High Court",
  3: "Bombay High Court",
  4: "Gujarat High Court",
  5: "Allahabad High Court",
  6: "Gauhati High Court",
  7: "Punjab & Haryana High Court",
  8: "Madras High Court",
  9: "Andhra Pradesh High Court",
  10: "Karnataka High Court",
  11: "Calcutta High Court",
  12: "Madhya Pradesh High Court",
  13: "Kerala High Court",
  14: "Patna High Court",
  15: "Orissa High Court",
  16: "Rajasthan High Court",
  17: "Jharkhand High Court",
  18: "Himachal Pradesh High Court",
  19: "Jammu & Kashmir High Court",
  20: "Sikkim High Court",
  21: "Chhattisgarh High Court",
  22: "Uttarakhand High Court",
  23: "Tribunals",
  24: "Privy Council",
  25: "Federal Court",
  26: "Nagpur High Court",
  27: "Lahore High Court",
  28: "Sindh",
  29: "Rangoon High Court",
  30: "Peshawar High Court",
  40: "Oudh",
  49: "Appellate Tribunal For Electricity",
  50: "Authority For Advance Rulings",
  51: "Armed Forces Tribunal",
  52: "Competition Appellate Tribunal",
  53: "Central Sales Tax",
  54: "Central Electricity Regulatory Commission",
  55: "Central Information Commission",
  56: "Company Law Board",
  57: "Copyright Board",
  58: "MRTP",
  59: "EPFAT",
  76: "NCDRC",
  77: "Cyber Appellate Tribunal",
  78: "Intellectual Property Appellate Board",
  79: "TDSAT",
  80: "Debts Recovery Appellate Tribunal",
  81: "CEGAT / CESTAT",
  82: "Meghalaya High Court",
  83: "Tripura High Court",
  84: "Manipur High Court",
  85: "Appellate Tribunal For Foreign Exchange",
  86: "Securities & Exchange Board of India",
  87: "Securities Appellate Tribunal",
  88: "Central Administrative Tribunal",
  89: "Debts Recovery Tribunal",
  90: "National Green Tribunal",
  91: "Travancore-Cochin",
  92: "Appellate Tribunal For Forfeited Property",
  93: "Appellate Tribunal Under Prevention of Money Laundering",
  94: "Appellate Authority for Industrial and Financial Reconstruction",
  96: "Income Tax Appellate Tribunal",
  97: "Saurashtra",
  98: "Kutch",
  99: "West Bengal Taxation Tribunal",
  100: "Trademark Registry",
  102: "National Company Law Tribunal (NCLT)",
  103: "National Company Law Appellate Tribunal",
  104: "Telangana High Court",
};

function toInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown): string | null {
  const out = String(value ?? "").trim();
  return out || null;
}

function getCourtLabel(params: {
  subid: number;
  title?: string | null;
  subtitle?: string | null;
}) {
  const { subid, title, subtitle } = params;
  return subtitle || COURT_LABELS_BY_SUBID[subid] || title || `Court ${subid}`;
}

function isAllowedCourtOptionLike(value: unknown): value is AllowedCourtOption {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return Number.isFinite(Number(obj.id)) && typeof obj.label === "string";
}

export function normalizeAllowedCourtOptions(value: unknown): AllowedCourtOption[] {
  let raw: unknown = value;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
      raw = JSON.parse(trimmed);
    } catch {
      raw = trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item));
    }
  }

  const map = new Map<number, AllowedCourtOption>();

  const push = (item: AllowedCourtOption) => {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "number" || typeof item === "string") {
        const subid = toInt(item);
        if (subid == null) continue;

        push({
          id: subid,
          groupId: null,
          title: null,
          subtitle: COURT_LABELS_BY_SUBID[subid] || null,
          label: getCourtLabel({ subid }),
        });
        continue;
      }

      if (!item || typeof item !== "object") continue;

      if (isAllowedCourtOptionLike(item)) {
        push({
          id: Number(item.id),
          groupId: item.groupId ?? null,
          title: item.title ?? null,
          subtitle: item.subtitle ?? null,
          label: item.label,
        });
        continue;
      }

      const obj = item as Record<string, unknown>;
      const parentId = toInt(obj.id);
      const subid = toInt(obj.subid) ?? toInt(obj.subId);

      if (subid == null) continue;

      const title = text(obj.title);
      const subtitle = text(obj.subtitle);

      push({
        id: subid,
        groupId: parentId ?? null,
        title,
        subtitle: subtitle || COURT_LABELS_BY_SUBID[subid] || null,
        label: getCourtLabel({
          subid,
          title,
          subtitle,
        }),
      });
    }
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function extractAllowedCourtsFromUser(
  user:
    | {
        allowedCourts?: unknown;
        allowedCourtIdsJson?: unknown;
        allowedCourtIds?: unknown;
      }
    | null
    | undefined
) {
  const raw =
    user?.allowedCourts ??
    user?.allowedCourtIdsJson ??
    user?.allowedCourtIds;

  return normalizeAllowedCourtOptions(raw);
}