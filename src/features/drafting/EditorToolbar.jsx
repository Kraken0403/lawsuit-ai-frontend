import React from "react";

export default function EditorToolbar({
  editor,
  onSaveVersion,
  onOpenMissing,
  onRegenerateSection,
}) {
  if (!editor) return null;

  const buttonClass =
    "rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50";
  const activeButtonClass =
    "rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm text-white";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-3">
      <button
        className={editor.isActive("bold") ? activeButtonClass : buttonClass}
        onClick={() => editor.chain().focus().toggleBold().run()}
        type="button"
      >
        Bold
      </button>

      <button
        className={editor.isActive("italic") ? activeButtonClass : buttonClass}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        type="button"
      >
        Italic
      </button>

      <button
        className={editor.isActive("strike") ? activeButtonClass : buttonClass}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        type="button"
      >
        Strike
      </button>

      <button
        className={editor.isActive("heading", { level: 1 }) ? activeButtonClass : buttonClass}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        type="button"
      >
        H1
      </button>

      <button
        className={editor.isActive("heading", { level: 2 }) ? activeButtonClass : buttonClass}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        type="button"
      >
        H2
      </button>

      <button
        className={editor.isActive("bulletList") ? activeButtonClass : buttonClass}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        type="button"
      >
        Bullets
      </button>

      <button
        className={editor.isActive("orderedList") ? activeButtonClass : buttonClass}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        type="button"
      >
        Numbered
      </button>

      <button
        className={buttonClass}
        onClick={() => editor.chain().focus().undo().run()}
        type="button"
      >
        Undo
      </button>

      <button
        className={buttonClass}
        onClick={() => editor.chain().focus().redo().run()}
        type="button"
      >
        Redo
      </button>

      <div className="ml-auto flex flex-wrap gap-2">
        <button className={buttonClass} onClick={onOpenMissing} type="button">
          Missing fields
        </button>

        <button className={buttonClass} onClick={onRegenerateSection} type="button">
          Regenerate section
        </button>

        <button
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
          onClick={onSaveVersion}
          type="button"
        >
          Save version
        </button>
      </div>
    </div>
  );
}