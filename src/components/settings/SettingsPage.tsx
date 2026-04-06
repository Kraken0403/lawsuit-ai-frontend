import { useEffect, useMemo, useRef, useState } from "react";
import NotificationSnackbar from "../ui/NotificationSnackbar";
import {
  draftingSettingsService,
  EMPTY_DRAFTING_SETTINGS,
  type DraftBrandingMode,
  type DraftingAssetKind,
  type DraftingSettings,
} from "../../services/draftingSettingsService";

type SettingsPageProps = {
  initialSettings: DraftingSettings | null;
  loading?: boolean;
  onSettingsSaved?: (settings: DraftingSettings) => void;
};

type SettingsTab = "firm" | "drafting";
type NoticeState = {
  open: boolean;
  message: string;
  severity: "success" | "error" | "info" | "warning";
};

type DraftingAssetField =
  | "draftingHeaderImageUrl"
  | "draftingFooterImageUrl"
  | "draftingLetterheadImageUrl"
  | "draftingSignatureImageUrl";

const ASSET_FIELD_BY_KIND: Record<DraftingAssetKind, DraftingAssetField> = {
  header: "draftingHeaderImageUrl",
  footer: "draftingFooterImageUrl",
  letterhead: "draftingLetterheadImageUrl",
  signature: "draftingSignatureImageUrl",
};

function AssetUploadCard({
  title,
  description,
  kind,
  imageUrl,
  busy,
  onUpload,
  onDelete,
}: {
  title: string;
  description: string;
  kind: DraftingAssetKind;
  imageUrl: string;
  busy: boolean;
  onUpload: (kind: DraftingAssetKind, file: File) => Promise<void>;
  onDelete: (kind: DraftingAssetKind) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </div>
        </div>

        {imageUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(kind)}
            className="cursor-pointer rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 disabled:opacity-60"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        {imageUrl ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img
              src={imageUrl}
              alt={title}
              className="max-h-[180px] w-full object-contain"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No file uploaded yet.
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await onUpload(kind, file);
            e.currentTarget.value = "";
          }}
        />

        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-xl bg-[#114C8D] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Uploading..." : imageUrl ? "Replace Image" : "Upload Image"}
        </button>
      </div>
    </div>
  );
}

function SettingsInput({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      {multiline ? (
        <textarea
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#114C8D]"
        />
      ) : (
        <input
          type={type}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#114C8D]"
        />
      )}
    </label>
  );
}

export default function SettingsPage({
  initialSettings,
  loading = false,
  onSettingsSaved,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("drafting");
  const [form, setForm] = useState<DraftingSettings>(
    initialSettings || EMPTY_DRAFTING_SETTINGS
  );
  const [saving, setSaving] = useState(false);
  const [busyAssetKind, setBusyAssetKind] = useState<DraftingAssetKind | null>(
    null
  );
  const [notice, setNotice] = useState<NoticeState>({
    open: false,
    message: "",
    severity: "info",
  });
  const [tempPreviewUrls, setTempPreviewUrls] = useState<
    Record<DraftingAssetKind, string>
  >({
    header: "",
    footer: "",
    letterhead: "",
    signature: "",
  });

  const objectUrlRef = useRef<Record<DraftingAssetKind, string | null>>({
    header: null,
    footer: null,
    letterhead: null,
    signature: null,
  });

  useEffect(() => {
    setForm(initialSettings || EMPTY_DRAFTING_SETTINGS);
  }, [initialSettings]);

  useEffect(() => {
    return () => {
      Object.values(objectUrlRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const showNotice = (
    message: string,
    severity: NoticeState["severity"] = "info"
  ) => {
    setNotice({
      open: true,
      message,
      severity,
    });
  };

  const updateField = <K extends keyof DraftingSettings>(
    key: K,
    value: DraftingSettings[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const refreshSettingsFromServer = async () => {
    const response = await draftingSettingsService.getSettings();
    setForm(response.settings);
    onSettingsSaved?.(response.settings);
    return response.settings;
  };

  const clearTempPreview = (kind: DraftingAssetKind) => {
    if (objectUrlRef.current[kind]) {
      URL.revokeObjectURL(objectUrlRef.current[kind] as string);
      objectUrlRef.current[kind] = null;
    }

    setTempPreviewUrls((prev) => ({
      ...prev,
      [kind]: "",
    }));
  };

  const setTempPreview = (kind: DraftingAssetKind, file: File) => {
    if (objectUrlRef.current[kind]) {
      URL.revokeObjectURL(objectUrlRef.current[kind] as string);
    }

    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current[kind] = localUrl;

    setTempPreviewUrls((prev) => ({
      ...prev,
      [kind]: localUrl,
    }));

    return localUrl;
  };

  const brandingMode = form.draftingBrandingMode as DraftBrandingMode;

  const assetUrls = useMemo(() => {
    return {
      header: tempPreviewUrls.header || form.draftingHeaderImageUrl,
      footer: tempPreviewUrls.footer || form.draftingFooterImageUrl,
      letterhead: tempPreviewUrls.letterhead || form.draftingLetterheadImageUrl,
      signature: tempPreviewUrls.signature || form.draftingSignatureImageUrl,
    };
  }, [
    tempPreviewUrls,
    form.draftingHeaderImageUrl,
    form.draftingFooterImageUrl,
    form.draftingLetterheadImageUrl,
    form.draftingSignatureImageUrl,
  ]);

  const saveSettings = async () => {
    setSaving(true);

    try {
            const response = await draftingSettingsService.saveSettings({
            firmName: form.firmName,
            advocateName: form.advocateName,
            enrollmentNumber: form.enrollmentNumber,
            address: form.address,
            email: form.email,
            phone: form.phone,
            website: form.website,
            logoUrl: form.logoUrl,
            headerText: form.headerText,
            footerText: form.footerText,
            signatureText: form.signatureText,

            draftingBrandingMode: form.draftingBrandingMode,
            draftingHeaderImageUrl: form.draftingHeaderImageUrl,
            draftingFooterImageUrl: form.draftingFooterImageUrl,
            draftingLetterheadImageUrl: form.draftingLetterheadImageUrl,
            draftingSignatureImageUrl: form.draftingSignatureImageUrl,
            draftingHeaderHeightPx: form.draftingHeaderHeightPx,
            draftingFooterHeightPx: form.draftingFooterHeightPx,
            draftingLetterheadHeightPx: form.draftingLetterheadHeightPx,
            draftingLockBranding: form.draftingLockBranding,
            draftingDefaultTone: form.draftingDefaultTone,
            draftingDefaultJurisdiction: form.draftingDefaultJurisdiction,
            draftingDefaultForum: form.draftingDefaultForum,
            });

      setForm(response.settings);
      onSettingsSaved?.(response.settings);
      showNotice("Settings saved successfully.", "success");
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Failed to save settings.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAsset = async (kind: DraftingAssetKind, file: File) => {
    const field = ASSET_FIELD_BY_KIND[kind];
    const localPreviewUrl = setTempPreview(kind, file);

    setBusyAssetKind(kind);

    try {
      const uploadResponse = await draftingSettingsService.uploadAsset(kind, file);

      let nextSettings: DraftingSettings | null = null;

      try {
        nextSettings = await refreshSettingsFromServer();
      } catch {
        nextSettings = null;
      }

      const finalUrl =
        nextSettings?.[field] ||
        uploadResponse.settings[field] ||
        uploadResponse.url ||
        localPreviewUrl;

      setForm((prev) => ({
        ...prev,
        ...(nextSettings || uploadResponse.settings || {}),
        [field]: finalUrl,
      }));

      onSettingsSaved?.({
        ...(nextSettings || uploadResponse.settings || form),
        [field]: finalUrl,
      });

      if (finalUrl && !finalUrl.startsWith("blob:")) {
        clearTempPreview(kind);
      }

      showNotice(`${titleCase(kind)} image uploaded successfully.`, "success");
    } catch (error) {
      clearTempPreview(kind);
      showNotice(
        error instanceof Error ? error.message : "Failed to upload image.",
        "error"
      );
    } finally {
      setBusyAssetKind(null);
    }
  };

  const handleDeleteAsset = async (kind: DraftingAssetKind) => {
    const field = ASSET_FIELD_BY_KIND[kind];

    setBusyAssetKind(kind);

    try {
      await draftingSettingsService.deleteAsset(kind);

      let nextSettings: DraftingSettings | null = null;

      try {
        nextSettings = await refreshSettingsFromServer();
      } catch {
        nextSettings = null;
      }

      clearTempPreview(kind);

      const merged = {
        ...(nextSettings || form),
        [field]: "",
      };

      setForm(merged);
      onSettingsSaved?.(merged);
      showNotice(`${titleCase(kind)} image removed.`, "success");
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Failed to delete image.",
        "error"
      );
    } finally {
      setBusyAssetKind(null);
    }
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
          <div className="mb-6">
            <div className="text-sm font-medium text-slate-500">
              Workspace Settings
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              Manage firm profile and Drafting Studio branding
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("firm")}
              className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === "firm"
                  ? "bg-[#114C8D] text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Firm Profile
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("drafting")}
              className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === "drafting"
                  ? "bg-[#114C8D] text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Drafting Studio
            </button>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
              <div className="text-sm text-slate-500">Loading settings...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {activeTab === "firm" && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 text-lg font-semibold text-slate-900">
                      Firm information
                    </div>

                    <div className="grid gap-4">
                      <SettingsInput
                        label="Firm name"
                        value={form.firmName}
                        onChange={(value) => updateField("firmName", value)}
                      />
                      <SettingsInput
                        label="Advocate / Representative name"
                        value={form.advocateName}
                        onChange={(value) => updateField("advocateName", value)}
                      />
                      <SettingsInput
                        label="Enrollment number"
                        value={form.enrollmentNumber}
                        onChange={(value) => updateField("enrollmentNumber", value)}
                      />
                      <SettingsInput
                        label="Email"
                        value={form.email}
                        onChange={(value) => updateField("email", value)}
                        type="email"
                      />
                      <SettingsInput
                        label="Phone"
                        value={form.phone}
                        onChange={(value) => updateField("phone", value)}
                      />
                      <SettingsInput
                        label="Website"
                        value={form.website}
                        onChange={(value) => updateField("website", value)}
                      />
                      <SettingsInput
                        label="Address"
                        value={form.address}
                        onChange={(value) => updateField("address", value)}
                        multiline
                      />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 text-lg font-semibold text-slate-900">
                      Firm text blocks
                    </div>

                    <div className="grid gap-4">
                      <SettingsInput
                        label="Header text"
                        value={form.headerText}
                        onChange={(value) => updateField("headerText", value)}
                        multiline
                      />
                      <SettingsInput
                        label="Footer text"
                        value={form.footerText}
                        onChange={(value) => updateField("footerText", value)}
                        multiline
                      />
                      <SettingsInput
                        label="Signature text"
                        value={form.signatureText}
                        onChange={(value) => updateField("signatureText", value)}
                        multiline
                      />
                      <SettingsInput
                        label="Logo URL"
                        value={form.logoUrl}
                        onChange={(value) => updateField("logoUrl", value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "drafting" && (
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 text-lg font-semibold text-slate-900">
                      Branding mode
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <label className="block">
                        <div className="mb-2 text-sm font-medium text-slate-700">
                          Branding mode
                        </div>
                        <select
                          value={brandingMode}
                          onChange={(e) =>
                            updateField(
                              "draftingBrandingMode",
                              e.target.value as DraftBrandingMode
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#114C8D]"
                        >
                          <option value="NONE">None</option>
                          <option value="HEADER_FOOTER">Header + Footer</option>
                          <option value="LETTERHEAD">Letterhead</option>
                        </select>
                      </label>

                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={form.draftingLockBranding}
                          onChange={(e) =>
                            updateField("draftingLockBranding", e.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            Lock branding in editor
                          </div>
                          <div className="text-xs text-slate-500">
                            Prevent accidental editing of header, footer, and
                            letterhead blocks.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <AssetUploadCard
                      title="Header image"
                      description="Used when mode is Header + Footer."
                      kind="header"
                      imageUrl={assetUrls.header}
                      busy={busyAssetKind === "header"}
                      onUpload={handleUploadAsset}
                      onDelete={handleDeleteAsset}
                    />

                    <AssetUploadCard
                      title="Footer image"
                      description="Used when mode is Header + Footer or Letterhead with footer."
                      kind="footer"
                      imageUrl={assetUrls.footer}
                      busy={busyAssetKind === "footer"}
                      onUpload={handleUploadAsset}
                      onDelete={handleDeleteAsset}
                    />

                    <AssetUploadCard
                      title="Full letterhead"
                      description="Used when mode is Letterhead."
                      kind="letterhead"
                      imageUrl={assetUrls.letterhead}
                      busy={busyAssetKind === "letterhead"}
                      onUpload={handleUploadAsset}
                      onDelete={handleDeleteAsset}
                    />

                    <AssetUploadCard
                      title="Signature image"
                      description="Optional reusable signature image for drafting output."
                      kind="signature"
                      imageUrl={assetUrls.signature}
                      busy={busyAssetKind === "signature"}
                      onUpload={handleUploadAsset}
                      onDelete={handleDeleteAsset}
                    />
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 text-lg font-semibold text-slate-900">
                      Drafting defaults
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <SettingsInput
                        label="Header height (px)"
                        value={form.draftingHeaderHeightPx}
                        onChange={(value) =>
                          updateField("draftingHeaderHeightPx", Number(value) || 110)
                        }
                        type="number"
                      />
                      <SettingsInput
                        label="Footer height (px)"
                        value={form.draftingFooterHeightPx}
                        onChange={(value) =>
                          updateField("draftingFooterHeightPx", Number(value) || 90)
                        }
                        type="number"
                      />
                      <SettingsInput
                        label="Letterhead height (px)"
                        value={form.draftingLetterheadHeightPx}
                        onChange={(value) =>
                          updateField(
                            "draftingLetterheadHeightPx",
                            Number(value) || 130
                          )
                        }
                        type="number"
                      />
                      <SettingsInput
                        label="Default tone"
                        value={form.draftingDefaultTone}
                        onChange={(value) =>
                          updateField("draftingDefaultTone", value)
                        }
                        placeholder="formal / strict / aggressive"
                      />
                      <SettingsInput
                        label="Default jurisdiction"
                        value={form.draftingDefaultJurisdiction}
                        onChange={(value) =>
                          updateField("draftingDefaultJurisdiction", value)
                        }
                      />
                      <SettingsInput
                        label="Default forum"
                        value={form.draftingDefaultForum}
                        onChange={(value) =>
                          updateField("draftingDefaultForum", value)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveSettings}
                  className="cursor-pointer rounded-2xl bg-[#114C8D] px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save settings"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <NotificationSnackbar
        open={notice.open}
        message={notice.message}
        severity={notice.severity}
        onClose={() =>
          setNotice((prev) => ({
            ...prev,
            open: false,
          }))
        }
      />
    </>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}