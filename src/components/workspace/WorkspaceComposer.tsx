import { useRef } from "react";
import type { KeyboardEvent } from "react";

type WorkspaceComposerProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string;
  placeholder: string;
  maxInputLength: number;
  remainingChars: number;
  canSend: boolean;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
  isDraftingMode?: boolean;
  draftAttachments?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
  }>;
  uploadingDraftAttachment?: boolean;
  onDraftFilePick?: (file: File) => void;
  onRemoveDraftAttachment?: (attachmentId: string) => void;
  speechSupported?: boolean;
  speechRecording?: boolean;
  speechTranscribing?: boolean;
  speechInterimText?: string;
  speechError?: string | null;
  onToggleSpeech?: () => void;
};

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </svg>
  );
}

export default function WorkspaceComposer({
  textareaRef,
  input,
  placeholder,
  maxInputLength,
  remainingChars,
  canSend,
  loading,
  onChange,
  onSubmit,
  onKeyDown,
  onStop,
  isDraftingMode = false,
  draftAttachments = [],
  uploadingDraftAttachment = false,
  onDraftFilePick,
  onRemoveDraftAttachment,
  speechSupported = false,
  speechRecording = false,
  speechTranscribing = false,
  speechInterimText = "",
  speechError = "",
  onToggleSpeech,
}: WorkspaceComposerProps) {
  const draftFileInputRef = useRef<HTMLInputElement | null>(null);

  const showSpeechBlock =
    isDraftingMode &&
    (speechRecording ||
      speechTranscribing ||
      Boolean(speechInterimText) ||
      Boolean(speechError));

  return (
    <div className="bg-transparent px-4 py-4 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[768px]">
        <form
          onSubmit={onSubmit}
          className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm"
        >
          {isDraftingMode ? (
            <input
              ref={draftFileInputRef}
              type="file"
              accept=".txt,.md,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onDraftFilePick) {
                  onDraftFilePick(file);
                }
                e.currentTarget.value = "";
              }}
            />
          ) : null}

          {(isDraftingMode && uploadingDraftAttachment) ||
          draftAttachments.length > 0 ||
          showSpeechBlock ? (
            <div className="mb-3 space-y-2 px-1">
              <div className="flex flex-wrap gap-2">
                {uploadingDraftAttachment ? (
                  <div className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    <FileIcon />
                    <span>Uploading format...</span>
                  </div>
                ) : null}

                {draftAttachments.map((item) => (
                  <div
                    key={item.id}
                    title={item.fileName}
                    className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  >
                    <FileIcon />
                    <span className="max-w-[220px] truncate">{item.fileName}</span>

                    <button
                      type="button"
                      onClick={() => onRemoveDraftAttachment?.(item.id)}
                      className="cursor-pointer inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                      aria-label={`Remove ${item.fileName}`}
                      title="Remove file"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ))}

                {speechRecording ? (
                  <div className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span>Listening... tap mic again to stop</span>
                  </div>
                ) : null}

                {speechTranscribing ? (
                  <div className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                    <SpinnerIcon />
                    <span>Transcribing speech...</span>
                  </div>
                ) : null}
              </div>

              {speechInterimText ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  <span className="font-medium text-slate-700">Live preview:</span>{" "}
                  {speechInterimText}
                </div>
              ) : null}

              {speechError ? (
                <div className="px-1 text-xs font-medium text-rose-600">
                  {speechError}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-end gap-3">
            {isDraftingMode ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => draftFileInputRef.current?.click()}
                  className="inline-flex h-[48px] w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                  aria-label="Upload drafting format"
                  title="Upload drafting format"
                >
                  <PlusIcon />
                </button>

                {speechSupported ? (
                  <button
                    type="button"
                    onClick={() => onToggleSpeech?.()}
                    disabled={speechTranscribing}
                    className={`relative inline-flex h-[48px] w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-2xl border transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      speechRecording
                        ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : speechTranscribing
                        ? "border-sky-200 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                    aria-label={speechRecording ? "Stop voice input" : "Start voice input"}
                    title={speechRecording ? "Stop voice input" : "Start voice input"}
                  >
                    {speechRecording ? (
                      <>
                        <span className="pointer-events-none absolute inset-0 rounded-2xl border border-rose-300 animate-ping opacity-60" />
                        <span className="pointer-events-none absolute inset-[-6px] rounded-[20px] border border-rose-200 animate-pulse opacity-70" />
                      </>
                    ) : null}

                    {speechTranscribing ? <SpinnerIcon /> : <MicIcon />}
                  </button>
                ) : null}
              </div>
            ) : null}

            <textarea
              ref={textareaRef}
              className="max-h-[220px] min-h-[52px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
              placeholder={placeholder}
              value={input}
              rows={1}
              maxLength={maxInputLength}
              onChange={(e) => onChange(e.target.value.slice(0, maxInputLength))}
              onKeyDown={onKeyDown}
            />

            {loading ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex h-[48px] w-[48px] cursor-pointer items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                aria-label="Stop generating"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="currentColor"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex h-[48px] w-[48px] cursor-pointer items-center justify-center rounded-2xl bg-[#114C8D] text-white transition hover:bg-[#0B3A6E] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                aria-label="Send message"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="currentColor"
                >
                  <path d="M3.4 20.4 21.85 12 3.4 3.6v6.55l13.2 1.85-13.2 1.85v6.55Z" />
                </svg>
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between px-3 pb-1 text-xs">
            <span className="text-slate-500">
              Enter to send · Shift + Enter for newline
            </span>

            <div className="flex items-center gap-3">
              <span
                className={
                  remainingChars <= 100
                    ? "font-medium text-amber-600"
                    : "text-slate-500"
                }
              >
                {input.length}/{maxInputLength}
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}