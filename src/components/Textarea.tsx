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

function ensureHeadingHashes(state: EditorState): Transaction | null {
  const { selection } = state;

  // Get the parent node
  const parent = selection.$from.parent;
  let from: number;
  let to: number;
  try {
    from = selection.$from.before();
    to = selection.$to.after();
  } catch (e) {
    return null;
  }

  const textContent = parent.textContent;

  // Track relative offset
  const relativeOffset = selection.$from.parentOffset;

  // Determine if we're in a heading or paragraph node
  if (parent.type.name === "heading" || parent.type.name === "paragraph") {
    // Extract the hashes and trailing space if they exist
    const match = textContent.match(/^(#{1,6}) /);
    if (match && match[1]) {
      // Determine the heading level based on the number of hashes
      const level = match[1].length;

      if (parent.type.name === "heading") {
        // If the level doesn't match the current heading level, adjust it
        if (level !== parent.attrs.level) {
          const tr = state.tr.setNodeMarkup(
            from,
            state.schema.nodes.heading,
            { level },
            parent.marks
          );
          return tr;
        }
      } else if (parent.type.name === "paragraph") {
        // If we're in a paragraph, change it to a heading with the appropriate level
        const tr = state.tr.setNodeMarkup(
          from,
          state.schema.nodes.heading,
          { level },
          parent.marks
        );
        return tr;
      }
    } else if (parent.type.name === "heading") {
      // If we're in a heading but there are no hashes, change it to a paragraph
      const tr = state.tr.setNodeMarkup(
        from,
        state.schema.nodes.paragraph,
        parent.attrs,
        parent.marks
      );
      tr.insertText(textContent, from, to);

      // Recreate selection within new paragraph node
      const selectionPos = from + 1 + relativeOffset;
      tr.setSelection(TextSelection.create(tr.doc, selectionPos));

      return tr;
    }
  }

  return null;
}

export const headingHashesPlugin = new Plugin({
  appendTransaction: (transactions, oldState, newState) => {
    // After each transaction, check if we need to ensure heading hashes
    if (transactions.some((tr) => tr.docChanged)) {
      return ensureHeadingHashes(newState);
    }
  },
});

function processNode(
  node: ProseMirrorNode,
  start: number,
  state: EditorState
): EditorState {
  const urlRegex =
    /\b((?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])\b/gi;

  const tr = state.tr;
  const pos = start;

  node.descendants((descendantNode, offset) => {
    const from = pos + offset;
    const to = from + descendantNode.nodeSize;

    if (descendantNode.isText) {
      descendantNode.marks
        .filter((mark) => mark.type.name === "link")
        .forEach((mark) => {
          tr.removeMark(from, to, mark);
        });
    }
  });

  const newState = state.apply(tr);
  const newNode = newState.doc.resolve(start).parent;
  const secondTr = newState.tr;
  newNode.descendants((descendantNode, offset) => {
    const from = pos + offset;
    let match;
    while (
      (match = urlRegex.exec(descendantNode.text ?? "")) !== null &&
      state.schema.marks.link
    ) {
      const start = match.index;
      const end = start + match[0].length;
      const url = match[0];
      const mark = state.schema.marks.link.create({ href: url });
      secondTr.addMark(from + start, from + end, mark);
    }
  });

  return newState.apply(secondTr);
}

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
  if (!$from.sameParent($to)) return false;

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

        // Set selection to the beginning of the new paragraph
        tr = tr.setSelection(TextSelection.create(tr.doc, hardBreakPos + 1));
      } else {
        tr = tr.replaceSelectionWith(hardBreak);
      }
    } else {
      tr = tr.replaceSelectionWith(paragraph);
      tr = tr.setSelection(
        TextSelection.create(tr.doc, $from.pos + paragraph.nodeSize - 1)
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
            setEditorState((s) => {
              const newState = s.apply(tr);
              return processNode(
                newState.selection.$anchor.parent,
                newState.selection.$anchor.posAtIndex(0),
                newState
              );
            });
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
                  const textNode = schema.text(
                    `${"#".repeat(level)} ${node.textContent}`
                  );
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

                if (node.isText) {
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
