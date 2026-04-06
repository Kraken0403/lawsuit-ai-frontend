type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmDialog({
  open,
  title = "Confirm action",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClass =
    confirmVariant === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-700"
      : "bg-[#114C8D] text-white hover:bg-[#0b3a6f]";

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="mt-2 text-sm leading-6 text-slate-600">{message}</div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${confirmClass}`}
          >
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}