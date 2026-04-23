import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AllowedCourtOption } from "../../lib/allowedCourts";

type Props = {
  availableCourts: AllowedCourtOption[];
  selectedCourtIds: number[];
  onChange: (ids: number[]) => void;
};

function ToggleSwitch({
  checked,
  onClick,
  ariaLabel,
}: {
  checked: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition cursor-pointer ${
        checked
          ? "border-slate-900 bg-slate-900"
          : "border-slate-300 bg-slate-200"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function CourtFilterPopover({
  availableCourts,
  selectedCourtIds,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<number[]>(selectedCourtIds);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setDraft(selectedCourtIds);
    }
  }, [selectedCourtIds, open]);

  useEffect(() => {
    if (!mounted) return;

    const originalOverflow = document.body.style.overflow;

    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = originalOverflow;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open, mounted]);

  const selectedCount = selectedCourtIds.length;
  const selectedSet = useMemo(() => new Set(draft), [draft]);

  const sortedCourts = useMemo(() => {
    return [...availableCourts].sort((a, b) => a.id - b.id);
  }, [availableCourts]);

  const toggle = (id: number) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllCourts = () => {
    setDraft([]);
  };

  if (!availableCourts.length) return null;

  const drawerUi = (
    <div
      className="fixed inset-0 z-[9999]"
      aria-modal="true"
      role="dialog"
      aria-labelledby="court-filter-title"
    >
      <div
        className="absolute inset-0 bg-slate-950/35 transition-opacity duration-300 opacity-100"
        onClick={() => setOpen(false)}
      />

      <div className="absolute right-0 top-0 flex h-screen w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 translate-x-0">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h3
              id="court-filter-title"
              className="text-xl font-semibold text-slate-900"
            >
              Courts filter
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Show results only from the courts you pick.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close court filter"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-4 hover:bg-slate-50">
            <div className="min-w-0">
              <div className="font-medium text-slate-800">
                All available courts
              </div>
              <div className="text-sm text-slate-500">
                Search through all the available courts associated with your subscription plan.
              </div>
            </div>

            <ToggleSwitch
              checked={draft.length === 0}
              onClick={selectAllCourts}
              ariaLabel="All available courts"
            />
          </div>

          <div className="space-y-3">
            {sortedCourts.map((court) => {
              const checked = selectedSet.has(court.id);

              return (
                <div
                  key={court.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-4 transition hover:bg-slate-50"
                >
                  <button
                    type="button"
                    onClick={() => toggle(court.id)}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <div className="font-medium text-slate-800">
                      {court.label}
                    </div>

                    {court.title && court.title !== court.label ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Group: {court.title}
                      </div>
                    ) : null}
                  </button>

                  <ToggleSwitch
                    checked={checked}
                    onClick={() => toggle(court.id)}
                    ariaLabel={`Toggle ${court.label}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={() => setDraft([])}
            className="cursor-pointer rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Clear
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
      >
        <span>Filter</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
          {selectedCount > 0 ? `${selectedCount} selected` : "All courts"}
        </span>
      </button>

      {mounted && open ? createPortal(drawerUi, document.body) : null}
    </>
  );
}

