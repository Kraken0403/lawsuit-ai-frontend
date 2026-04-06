import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

export const draftingEditorExtensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
  }),
  Markdown,
];