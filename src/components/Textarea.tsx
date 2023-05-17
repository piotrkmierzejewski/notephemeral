"use client";

import { EditorState } from "prosemirror-state";
import { undo, redo, history } from "prosemirror-history";
import { useEffect, useRef, useState } from "react";
import { ProseMirror } from "@nytimes/react-prosemirror";
import {
  type Node as ProseMirrorNode,
  Fragment,
  Slice,
} from "prosemirror-model";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { type MarkdownAstDoc, parseMarkdown } from "~/lib/parse-markdown";
import "./markdown.css";
import { generateMarkdown } from "~/lib/generate-markdown";
import { schema } from "~/lib/schema";

const content = `## Hello

This is a test Markdown file

this is
not a paragraph

Heading level 1
===============

[Duck Duck Go](https://duckduckgo.com)

My favorite search engine is [Duck Duck Go](https://duckduckgo.com). I use it every day.

`;

const markdownAstToDoc = (blocks: MarkdownAstDoc): ProseMirrorNode => {
  const pmBlocks = blocks.flatMap((block) => {
    let paragraphContent: ProseMirrorNode[] = [];
    const blockNodes: ProseMirrorNode[] = [];

    block.forEach((node) => {
      switch (node.type) {
        case "heading":
          // If we have any paragraph content, create a paragraph node first
          if (paragraphContent.length > 0) {
            blockNodes.push(
              schema.nodes.paragraph.create({}, paragraphContent)
            );
            paragraphContent = []; // reset paragraph content
          }
          blockNodes.push(
            schema.nodes.heading.create(
              { level: node.level },
              schema.text(node.content)
            )
          );
          break;
        case "text":
          paragraphContent.push(schema.text(node.content));
          break;
        case "lineBreak":
          paragraphContent.push(schema.nodes.hard_break.create());
          break;
        case "url":
          const linkMark = schema.marks.link.create({ href: node.content });
          const linkNode = schema.text(node.content, [linkMark]);
          paragraphContent.push(linkNode);
          break;
      }
    });

    // If there's any remaining paragraph content, create a paragraph node
    if (paragraphContent.length > 0) {
      blockNodes.push(schema.nodes.paragraph.create({}, paragraphContent));
    }

    return blockNodes;
  });

  return schema.nodes.doc.create({}, pmBlocks);
};

export function Textarea() {
  const ref = useRef<HTMLDivElement | null>(null);
  const clickedLinkRef = useRef<ProseMirrorNode | null>(null);
  const [mount, setMount] = useState<HTMLDivElement | null>(ref.current);

  const parsedContent = parseMarkdown(content);
  const doc = markdownAstToDoc(parsedContent);

  const [editorState, setEditorState] = useState(
    EditorState.create({
      schema,
      doc,
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

  return (
    <div>
      <ProseMirror
        mount={mount}
        state={editorState}
        dispatchTransaction={(tr) => {
          setEditorState((s) => s.apply(tr));
        }}
        transformPastedHTML={(html) => {
          console.log("html", html);

          return html;
        }}
        transformPasted={(slice) => {
          // Define a recursive function to walk through the fragment and its children.
          const walk = (fragment: Fragment): Fragment => {
            const nodes: ProseMirrorNode[] = [];

            fragment.forEach((node) => {
              if (node.type.name === "heading") {
                // If this is a heading node, prefix its content with Markdown-style hashtags.
                const level = node.attrs.level as number;
                const textNode = schema.text(
                  `${"#".repeat(level)} ${node.textContent}`
                );
                const headingNode = schema.nodes.heading.create(
                  node.attrs,
                  textNode,
                  node.marks
                );
                nodes.push(headingNode);
              } else if (node.isText) {
                // If this is a text node, check if it has a link mark.
                const linkMark = node.marks.find(
                  (mark) => mark.type.name === "link"
                );
                if (linkMark) {
                  // If it has a link mark, remove the mark.
                  const textNode = node.mark(
                    node.marks.filter((mark) => mark !== linkMark)
                  );
                  nodes.push(textNode);
                } else {
                  // If it doesn't have a link mark, leave it as it is.
                  nodes.push(node);
                }
              } else if (node.content.childCount) {
                // If this node has children, walk through them.
                nodes.push(node.copy(walk(node.content)));
              } else {
                // If this is not a heading or link node and it doesn't have children, leave it as it is.
                nodes.push(node);
              }
            });

            return Fragment.fromArray(nodes);
          };

          // Transform the pasted content.
          return new Slice(walk(slice.content), slice.openStart, slice.openEnd);
        }}
        handleClickOn={(_, pos, node, nodePos) => {
          const potentialLink = node.nodeAt(pos - nodePos - 1);

          if (!potentialLink) {
            return;
          }

          if (
            !clickedLinkRef.current ||
            clickedLinkRef.current !== potentialLink
          ) {
            clickedLinkRef.current = potentialLink;
            return;
          }

          if (
            clickedLinkRef.current === potentialLink &&
            potentialLink.isText &&
            potentialLink.marks.some((mark) => mark.type.name === "link")
          ) {
            const linkMark = potentialLink.marks.find(
              (mark) => mark.type.name === "link"
            );

            if (!linkMark?.attrs?.href) {
              return;
            }

            const href = linkMark?.attrs?.href as string;
            window.open(href, "_blank");
            clickedLinkRef.current = null;
            return true;
          }
          return false;
        }}
        handleDoubleClickOn={(_, pos, node, nodePos) => {
          const potentialLink = node.nodeAt(pos - nodePos - 1);

          if (!potentialLink) {
            return;
          }

          // if (!clickedLinkRef.current) {
          //   clickedLinkRef.current = potentialLink;
          //   return;
          // }

          if (
            // clickedLinkRef.current === potentialLink &&
            potentialLink.isText &&
            potentialLink.marks.some((mark) => mark.type.name === "link")
          ) {
            const linkMark = potentialLink.marks.find(
              (mark) => mark.type.name === "link"
            );

            if (!linkMark?.attrs?.href) {
              return;
            }

            const href = linkMark?.attrs?.href as string;
            window.open(href, "_blank");
            clickedLinkRef.current = null;
            return true;
          }
          return false;
        }}
      >
        <div className="markdown" ref={ref} />
      </ProseMirror>
      <pre className="bg-slate-200">{generateMarkdown(editorState.doc)}</pre>
    </div>
  );
}
