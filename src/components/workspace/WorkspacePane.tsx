import type { KeyboardEvent, RefObject } from "react";
import type { AppMessage } from "../../lib/appHelpers";
import type { CaseDigest } from "../../streamChat";
import WorkspaceMessages from "./WorkspaceMessages";
import WorkspaceComposer from "./WorkspaceComposer";

type WorkspacePaneProps = {
  messages: AppMessage[];
  messagesLoading: boolean;
  hasUserMessages: boolean;
  userName?: string | null;
  greetingTitle: string;
  suggestions: string[];
  isDraftingMode: boolean;
  activeAssistantId: string | null;
  activeAssistantRef: RefObject<HTMLDivElement | null>;
  activeLoadingThought: string;
  isCaseBookmarked: (item: CaseDigest) => boolean;
  onCaseOpen: (item: CaseDigest) => void;
  onCaseSummarize: (item: CaseDigest) => void;
  onToggleBookmark: (item: CaseDigest) => void;
  onPdfClick: (item: CaseDigest) => void;
  onSuggestionClick: (value: string) => void;
  onQuickReply: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  placeholder: string;
  maxInputLength: number;
  remainingChars: number;
  canSend: boolean;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onComposerKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
  compactMode?: boolean;
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

export default function WorkspacePane({
  compactMode = false,
  ...props
}: WorkspacePaneProps) {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <WorkspaceMessages
          messages={props.messages}
          messagesLoading={props.messagesLoading}
          hasUserMessages={props.hasUserMessages}
          userName={props.userName}
          greetingTitle={props.greetingTitle}
          suggestions={props.suggestions}
          isDraftingMode={props.isDraftingMode}
          activeAssistantId={props.activeAssistantId}
          activeAssistantRef={props.activeAssistantRef}
          activeLoadingThought={props.activeLoadingThought}
          isCaseBookmarked={props.isCaseBookmarked}
          onCaseOpen={props.onCaseOpen}
          onCaseSummarize={props.onCaseSummarize}
          onToggleBookmark={props.onToggleBookmark}
          onPdfClick={props.onPdfClick}
          onSuggestionClick={props.onSuggestionClick}
          onQuickReply={props.onQuickReply}
          compactMode={compactMode}
        />
      </div>

      <div className="shrink-0">
        <WorkspaceComposer
          textareaRef={props.textareaRef}
          input={props.input}
          placeholder={props.placeholder}
          maxInputLength={props.maxInputLength}
          remainingChars={props.remainingChars}
          canSend={props.canSend}
          loading={props.loading}
          onChange={props.onInputChange}
          onSubmit={props.onSubmit}
          onKeyDown={props.onComposerKeyDown}
          onStop={props.onStop}
          isDraftingMode={props.isDraftingMode}
          draftAttachments={props.draftAttachments}
          uploadingDraftAttachment={props.uploadingDraftAttachment}
          onDraftFilePick={props.onDraftFilePick}
          onRemoveDraftAttachment={props.onRemoveDraftAttachment}
          speechSupported={props.speechSupported}
          speechRecording={props.speechRecording}
          speechTranscribing={props.speechTranscribing}
          speechInterimText={props.speechInterimText}
          speechError={props.speechError}
          onToggleSpeech={props.onToggleSpeech}
        />
      </div>
    </section>
  );
}