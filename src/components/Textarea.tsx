"use client";

import { EditorState } from "prosemirror-state";
import { undo, redo, history } from "prosemirror-history";
import { useEffect, useRef, useState } from "react";
import { ProseMirror } from "@nytimes/react-prosemirror";
import { Schema } from "prosemirror-model";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";

const content = `## Hello
This is a test Markdown file

this is
not a paragraph

Heading level 1
===============

[Duck Duck Go](https://duckduckgo.com)

My favorite search engine is [Duck Duck Go](https://duckduckgo.com). I use it every day.

`;

const textSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "text*",
      toDOM() {
        return ["p", 0];
      },
    },
    blockquote: {
      group: "block",
      content: "block+",
      toDOM() {
        return ["blockquote", 0];
      },
    },
    heading: {
      attrs: { level: { default: 1 } },
      content: "(text)*",
      group: "block",
      defining: true,
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        // { tag: "h2", attrs: { level: 2 } },
        // { tag: "h3", attrs: { level: 3 } },
        // { tag: "h4", attrs: { level: 4 } },
        // { tag: "h5", attrs: { level: 5 } },
        // { tag: "h6", attrs: { level: 6 } },
      ],
      toDOM(node) {
        return [`h${node.attrs.level as number}`, { class: "text-2xl" }, 0];
      },
    },

    text: {
      group: "inline",
    },
  },
});

function parseMarkdown() {
  return textSchema.node(
    "doc",
    null,
    content.split("\n").map((line) => {
      if (line && line.startsWith("#")) {
        return textSchema.node("heading", null, [textSchema.text(line)]);
      }

      return textSchema.node(
        "paragraph",
        null,
        line ? [textSchema.text(line)] : []
      );
    })
  );
}

export function Textarea() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mount, setMount] = useState<HTMLDivElement | null>(ref.current);

  const [editorState, setEditorState] = useState(
    EditorState.create({
      schema: textSchema,
      doc: parseMarkdown(),
      plugins: [
        history(),
        keymap({ "Mod-z": undo, "Mod-y": redo }),
        keymap(baseKeymap),
      ],
    })
  );

  useEffect(() => {
    setMount(ref.current);
  }, [setMount]);

  console.log("editorState.doc", editorState.doc);

  return (
    <div>
      <ProseMirror
        mount={mount}
        state={editorState}
        dispatchTransaction={(tr) => {
          setEditorState((s) => s.apply(tr));
        }}
      >
        <div ref={ref} />
      </ProseMirror>
    </div>
  );
}
