import { useEffect } from "react";
import { createPortal } from "react-dom";

export type NotificationSeverity = "success" | "error" | "info" | "warning";

type NotificationSnackbarProps = {
  open: boolean;
  message: string;
  severity?: NotificationSeverity;
  duration?: number;
  onClose: () => void;
};

const toneClasses: Record<NotificationSeverity, string> = {
  success: "border-emerald-300 bg-emerald-500 text-white shadow-emerald-200/60",
  error: "border-rose-300 bg-rose-500 text-white shadow-rose-200/60",
  info: "border-sky-300 bg-sky-500 text-white shadow-sky-200/60",
  warning: "border-amber-300 bg-amber-400 text-slate-900 shadow-amber-200/60",
};

export default function NotificationSnackbar({
  open,
  message,
  severity = "info",
  duration = 3200,
  onClose,
}: NotificationSnackbarProps) {
  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => window.clearTimeout(timeout);
  }, [open, duration, onClose]);

  if (!open || !message || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[9999] flex justify-center px-4">
      <div
        className={`relative pointer-events-auto flex w-full max-w-[440px] items-center gap-3 rounded-[6px] border px-5 py-4 shadow-2xl backdrop-blur-sm ${toneClasses[severity]}`}
      >
        <div className="flex-1 text-center">
          <div className="text-[15px] font-semibold leading-6">{message}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer absolute right-[10px] rounded-lg px-2 py-1 text-xs font-bold opacity-80 transition hover:bg-white/15 hover:opacity-100"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </div>,
    document.body
  );
}