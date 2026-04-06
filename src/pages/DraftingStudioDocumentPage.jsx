import React, { useEffect, useMemo, useState } from "react";
import DraftingEditor from "../features/drafting/DraftingEditor";

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

function MissingFieldRow({ field, onSubmit }) {
  const [value, setValue] = useState("");

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 text-sm font-medium">{field}</div>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder={`Enter ${field}`}
      />

      <button
        onClick={() => {
          if (!value.trim()) return;
          onSubmit({ [field]: value.trim() });
          setValue("");
        }}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
        type="button"
      >
        Fill
      </button>
    </div>
  );
}

export default function DraftingStudioDocumentPage({ documentId }) {
  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [showMissing, setShowMissing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [regenerateKey, setRegenerateKey] = useState("");
  const [regenerateInstructions, setRegenerateInstructions] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const docRes = await api(`/api/drafting/documents/${documentId}`);
      const versionsRes = await api(`/api/drafting/documents/${documentId}/versions`);

      setDocument(docRes.document);
      setVersions(versionsRes.versions || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!documentId) return;
    load();
  }, [documentId]);

  async function handleAutosave(payload) {
    const res = await api(`/api/drafting/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    setDocument((prev) => ({
      ...prev,
      ...res.document,
    }));
  }

  async function handleSaveVersion(payload) {
    setSavingVersion(true);
    try {
      const res = await api(`/api/drafting/documents/${documentId}/versions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setDocument(res.document);
      await load();
    } finally {
      setSavingVersion(false);
    }
  }

  async function handleFillMissing(values) {
    const res = await api(`/api/drafting/documents/${documentId}/fill-fields`, {
      method: "POST",
      body: JSON.stringify({
        values,
        createVersion: true,
      }),
    });

    setDocument(res.document);
    await load();
  }

  async function handleRegenerateSection() {
    if (!regenerateKey.trim()) {
      window.alert("Enter a section heading first.");
      return;
    }

    setRegenerating(true);
    try {
      const res = await api(`/api/drafting/documents/${documentId}/regenerate-section`, {
        method: "POST",
        body: JSON.stringify({
          sectionKey: regenerateKey,
          instructions: regenerateInstructions,
          createVersion: true,
        }),
      });

      setDocument(res.document);
      await load();
    } finally {
      setRegenerating(false);
    }
  }

  const missingFields = useMemo(() => {
    if (!document?.unresolvedPlaceholdersJson) return [];
    return Array.isArray(document.unresolvedPlaceholdersJson)
      ? document.unresolvedPlaceholdersJson
      : [];
  }, [document]);

  if (loading) {
    return <div className="p-6">Loading document...</div>;
  }

  if (!document) {
    return <div className="p-6">Document not found.</div>;
  }

  return (
    <div className="grid min-h-screen grid-cols-[320px_minmax(0,1fr)_320px] gap-4 bg-slate-50 p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4 text-lg font-semibold">AI / Actions</div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Section heading
            </label>
            <input
              value={regenerateKey}
              onChange={(e) => setRegenerateKey(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Example: Fees and Payment"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Regeneration instructions
            </label>
            <textarea
              value={regenerateInstructions}
              onChange={(e) => setRegenerateInstructions(e.target.value)}
              className="min-h-[120px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Example: Make this section stricter and more protective for the service provider."
            />
          </div>

          <button
            onClick={handleRegenerateSection}
            disabled={regenerating}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
            type="button"
          >
            {regenerating ? "Regenerating..." : "Regenerate section"}
          </button>
        </div>
      </div>

      <DraftingEditor
        document={document}
        onAutosave={handleAutosave}
        onSaveVersion={handleSaveVersion}
        onOpenMissing={() => setShowMissing((v) => !v)}
        onRegenerateSection={handleRegenerateSection}
      />

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-semibold">Versions</div>
            <div className="text-xs text-slate-500">
              {savingVersion ? "Saving version..." : `${versions.length} saved`}
            </div>
          </div>

          <div className="space-y-2">
            {versions.map((version) => (
              <div key={version.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="font-medium">Version {version.versionNumber}</div>
                <div className="text-slate-500">
                  {new Date(version.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {showMissing && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-lg font-semibold">Missing fields</div>

            <div className="space-y-3">
              {missingFields.length === 0 ? (
                <div className="text-sm text-slate-500">No unresolved placeholders.</div>
              ) : (
                missingFields.map((field) => (
                  <MissingFieldRow
                    key={field}
                    field={field}
                    onSubmit={handleFillMissing}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}