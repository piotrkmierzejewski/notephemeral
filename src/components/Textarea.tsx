"use client";

import { EditorState } from "prosemirror-state";
import { schema } from "prosemirror-schema-basic";
import { useEffect, useRef, useState } from "react";
import { ProseMirror } from "@nytimes/react-prosemirror";
import "prosemirror-view/style/prosemirror.css";

export function Textarea() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mount, setMount] = useState<HTMLDivElement | null>(ref.current);
  const [editorState, setEditorState] = useState(
    EditorState.create({ schema })
  );

  useEffect(() => {
    setMount(ref.current);
  }, [setMount]);

  return (
    <ProseMirror
      mount={mount}
      state={editorState}
      dispatchTransaction={(tr) => {
        setEditorState((s) => s.apply(tr));
      }}
    >
      <div ref={ref} />
    </ProseMirror>
  );
}
