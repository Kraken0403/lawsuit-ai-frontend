import React, { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { draftingEditorExtensions } from "./editorExtensions";
import EditorToolbar from "./EditorToolbar";
import "./drafting-editor.css";

function debounce(fn, wait) {
  let timer = null;

  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

export default function DraftingEditor({
  document,
  onAutosave,
  onSaveVersion,
  onOpenMissing,
  onRegenerateSection,
}) {
  const [isSaving, setIsSaving] = useState(false);
  const saveRef = useRef(null);

  const initialContent = useMemo(() => {
    if (document?.editorJson) return document.editorJson;
    return document?.draftMarkdown || "# Draft";
  }, [document]);

  const editor = useEditor({
    extensions: draftingEditorExtensions,
    content: initialContent,
    contentType: document?.editorJson ? undefined : "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap",
      },
    },
    onCreate: ({ editor }) => {
      saveRef.current = debounce(async () => {
        setIsSaving(true);
        try {
          await onAutosave({
            editorJson: editor.getJSON(),
            draftMarkdown: editor.getMarkdown ? editor.getMarkdown() : "",
          });
        } finally {
          setIsSaving(false);
        }
      }, 900);
    },
    onUpdate: () => {
      if (!saveRef.current) return;
      saveRef.current();
    },
  });

  useEffect(() => {
    if (!editor) return;

    if (document?.editorJson) {
      editor.commands.setContent(document.editorJson, false);
      return;
    }

    if (document?.draftMarkdown) {
      editor.commands.setContent(document.draftMarkdown, {
        contentType: "markdown",
        emitUpdate: false,
      });
    }
  }, [editor, document?.id, document?.updatedAt]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <EditorToolbar
        editor={editor}
        onSaveVersion={() =>
          onSaveVersion({
            editorJson: editor?.getJSON?.(),
            draftMarkdown: editor?.getMarkdown?.() || "",
          })
        }
        onOpenMissing={onOpenMissing}
        onRegenerateSection={onRegenerateSection}
      />

      <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
        {isSaving ? "Saving..." : "All changes saved"}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}