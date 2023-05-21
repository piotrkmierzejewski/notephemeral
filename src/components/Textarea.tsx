"use client";

import {
  Plugin,
  type Transaction,
  EditorState,
  TextSelection,
} from "prosemirror-state";
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

export const headingHashesPlugin = new Plugin({
  appendTransaction: (_, __, newState) => {
    const tr = newState.tr;

    newState.doc.descendants((node, offset, parent) => {
      if (node.isText && parent) {
        const match = node.textContent.match(/^(#{1,6}) /);
        if (match && match[0] && match[1]) {
          const level = match[1].length;

          if (parent.type.name === "heading") {
            if (level !== parent.attrs.level) {
              tr.setBlockType(
                offset,
                offset + node.nodeSize,
                newState.schema.nodes.heading!,
                { level }
              );
            }
          } else {
            if (parent.type.name === "paragraph") {
              const $end = newState.doc.resolve(offset + node.nodeSize);
              const nextNode = $end.nodeAfter;
              if (nextNode && nextNode.type.name === "hard_break") {
                tr.split(offset + node.nodeSize);
              }

              tr.setBlockType(
                offset,
                offset + node.nodeSize,
                newState.schema.nodes.heading!,
                { level }
              );

              return;
            }
          }
        } else {
          if (parent.type.name === "heading") {
            if (node.marks.length > 0) {
              tr.removeMark(offset, offset + node.nodeSize);
            } else {
              tr.setBlockType(
                offset,
                offset + node.nodeSize,
                newState.schema.nodes.paragraph!,
                parent.attrs
              );
            }
          }
        }
      }
    });

    return tr.docChanged ? tr : null;
  },
});

export const urlsPlugin = new Plugin({
  appendTransaction: (_, __, newState) => {
    const tr = newState.tr;
    const urlRegex =
      /\b((?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])\b/gi;

    const node = newState.doc;

    node.descendants((descendantNode, offset) => {
      const from = offset;
      const to = from + descendantNode.nodeSize;

      if (
        descendantNode.type.name === "paragraph" &&
        descendantNode.textContent &&
        newState.schema.marks.link
      ) {
        tr.removeMark(from, to, newState.schema.marks.type);

        let match;
        while ((match = urlRegex.exec(descendantNode.textContent)) !== null) {
          const start = offset + match.index + 1;
          const end = start + match[0].length;
          const url = match[0];
          const mark = newState.schema.marks.link.create({ href: url });
          tr.addMark(start, end, mark);
        }
      }
    });

    return tr.docChanged ? tr : null;
  },
});

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

const insertNewline = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void
) => {
  const { $from, $to, $head } = state.selection;
  if (
    !$from.sameParent($to) ||
    !state.schema.nodes.hard_break ||
    !state.schema.nodes.paragraph
  ) {
    return false;
  }

  let tr = state.tr;
  const hardBreak = state.schema.nodes.hard_break.create();
  const paragraph = state.schema.nodes.paragraph.create();

  if (dispatch) {
    if ($head.parent.type.name === "paragraph") {
      if ($from.nodeBefore?.type.name === "hard_break") {
        // Find the position of the previous hard_break
        let hardBreakPos = $from.pos;
        while ($from.doc.nodeAt(hardBreakPos)?.type.name !== "hard_break") {
          hardBreakPos--;
        }

        // Remove the old hard_break
        tr = tr.delete(hardBreakPos, $from.pos);

        // Split the paragraph at the position of the previous hard_break
        tr = tr.split(hardBreakPos);
      } else {
        tr = tr.replaceSelectionWith(hardBreak);
      }
    } else {
      tr = tr.replaceSelectionWith(paragraph);
      tr = tr.setSelection(
        TextSelection.create(tr.doc, $from.pos + paragraph.nodeSize)
      );
    }
    dispatch(tr.scrollIntoView());
  }

  return true;
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
        keymap({
          ...baseKeymap,
          Enter: insertNewline,
        }),
        headingHashesPlugin,
        urlsPlugin,
      ],
    })
  );

  useEffect(() => {
    setMount(ref.current);
  }, [setMount]);

  return (
    <>
      <div className="editor">
        <ProseMirror
          mount={mount}
          state={editorState}
          dispatchTransaction={(tr) => {
            setEditorState((s) => s.apply(tr));
          }}
          transformPasted={(slice) => {
            // Define a recursive function to walk through the fragment and its children.
            const walk = (fragment: Fragment): Fragment => {
              const nodes: ProseMirrorNode[] = [];

              fragment.forEach((node, _, index) => {
                if (node.type.name === "hard_break" && index > 0) {
                  // Check if the previous node was also a 'hard_break' and skip this node if it was
                  const prevNode = fragment.child(index - 1);
                  if (prevNode.type.name === "hard_break") {
                    return;
                  }
                }

                if (node.type.name === "heading") {
                  // If this is a heading node, prefix its content with Markdown-style hashtags.
                  const level = node.attrs.level as number;

                  const match = /^#{1,6} /.exec(node.textContent);
                  const text = match
                    ? node.textContent
                    : `${"#".repeat(level)} ${node.textContent}`;

                  const textNode = schema.text(text);
                  const headingNode = schema.nodes.heading.create(
                    node.attrs,
                    textNode,
                    node.marks
                  );
                  nodes.push(headingNode);
                  return;
                }

                if (node.isText || node.type.name === "paragraph") {
                  // If this is a text or paragraph node, check for Markdown-style heading syntax.
                  const match = /^#{1,6} /.exec(node.textContent);
                  if (match) {
                    const level = match[0].trim().length;
                    const textNode = schema.text(node.textContent);
                    const headingNode = schema.nodes.heading.create(
                      { level },
                      textNode,
                      node.marks
                    );
                    nodes.push(headingNode);
                    return;
                  }
                }

                // If it's a different type of node, or the paragraph didn't match a heading syntax
                // keep the original node, but continue to process its children if it has any
                if (node.content.size > 0) {
                  nodes.push(node.copy(walk(node.content)));
                } else {
                  nodes.push(node);
                }
              });

              return Fragment.fromArray(nodes);
            };

            // Transform the pasted content.
            return new Slice(
              walk(slice.content),
              slice.openStart,
              slice.openEnd
            );
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
      </div>
      <div>
        <pre className="bg-slate-200">{generateMarkdown(editorState.doc)}</pre>
      </div>
    </>
  );
}
