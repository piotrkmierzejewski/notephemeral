"use client";

import { EditorState, Plugin } from "prosemirror-state";
import { useEffect, useRef, useState } from "react";
import {
  schema,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import { ProseMirror } from "@nytimes/react-prosemirror";
import { exampleSetup } from "prosemirror-example-setup";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-menu/style/menu.css";
import "prosemirror-example-setup/style/style.css";
import "./markdown.css";

const content = `## Hello
This is a test Markdown file

Heading level 1
===============

[Duck Duck Go](https://duckduckgo.com)

`;

export function Textarea() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mount, setMount] = useState<HTMLDivElement | null>(ref.current);

  const [editorState, setEditorState] = useState(
    EditorState.create({
      doc: defaultMarkdownParser.parse(content) ?? undefined,
      plugins: [
        ...exampleSetup({ schema }),
        new Plugin({
          props: {
            attributes: { class: "markdown" },
          },
        }),
      ],
    })
  );

  useEffect(() => {
    setMount(ref.current);
  }, [setMount]);

  console.log("editorState", editorState);

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
