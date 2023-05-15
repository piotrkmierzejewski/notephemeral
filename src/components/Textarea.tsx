"use client";

import { EditorState } from "prosemirror-state";
import { undo, redo, history } from "prosemirror-history";
import { useEffect, useRef, useState } from "react";
import { ProseMirror } from "@nytimes/react-prosemirror";
import { type Node as ProseMirrorNode, Schema } from "prosemirror-model";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { type MarkdownAstDoc, parseMarkdown } from "~/lib/parse-markdown";
import "./markdown.css";

const content = `## Hello

This is a test Markdown file

this is
not a paragraph

Heading level 1
===============

[Duck Duck Go](https://duckduckgo.com)

My favorite search engine is [Duck Duck Go](https://duckduckgo.com). I use it every day.

`;

// const textSchema = new Schema({
//   nodes: {
//     doc: { content: "block+" },
//     paragraph: {
//       group: "block",
//       content: "text*",
//       toDOM() {
//         return ["p", 0];
//       },
//     },
//     linebreak: {
//       inline: true,
//       group: "inline",
//       selectable: false,
//       parseDOM: [{ tag: "br" }],
//       toDOM() {
//         return ["br"];
//       },
//     },
//     // link: {
//     //   attrs: {
//     //     href: {},
//     //     title: { default: null },
//     //   },
//     //   inclusive: false,
//     //   parseDOM: [
//     //     {
//     //       tag: "a[href]",
//     //       getAttrs(dom) {
//     //         return {
//     //           href: (dom as HTMLElement).getAttribute("href"),
//     //           title: (dom as HTMLElement).getAttribute("title"),
//     //         };
//     //       },
//     //     },
//     //   ],
//     //   toDOM(node) {
//     //     console.log("node", node);
//     //     return ["span", 0];
//     //   },
//     // },
//     blockquote: {
//       group: "block",
//       content: "block+",
//       toDOM() {
//         return ["blockquote", 0];
//       },
//     },
//     heading: {
//       attrs: { level: { default: 1 } },
//       content: "(text)*",
//       group: "block",
//       defining: true,
//       parseDOM: [
//         { tag: "h1", attrs: { level: 1 } },
//         // { tag: "h2", attrs: { level: 2 } },
//         // { tag: "h3", attrs: { level: 3 } },
//         // { tag: "h4", attrs: { level: 4 } },
//         // { tag: "h5", attrs: { level: 5 } },
//         // { tag: "h6", attrs: { level: 6 } },
//       ],
//       toDOM(node) {
//         return [`h${node.attrs.level as number}`, { class: "text-2xl" }, 0];
//       },
//     },

//     text: {
//       group: "inline",
//     },
//   },
// });

const schema = new Schema({
  nodes: {
    doc: {
      content: "block+",
    },
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM() {
        return ["p", 0];
      },
    },
    heading: {
      attrs: { level: { default: 1 } },
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
        { tag: "h4", attrs: { level: 4 } },
        { tag: "h5", attrs: { level: 5 } },
        { tag: "h6", attrs: { level: 6 } },
      ],
      toDOM(node) {
        return [`h${node.attrs.level as number}`, 0];
      },
    },
    text: {
      group: "inline",
    },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM() {
        return ["br"];
      },
    },
  },
  marks: {
    link: {
      attrs: {
        href: {},
        title: { default: null },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: "a[href]",
          getAttrs(dom) {
            return {
              href: (dom as HTMLAnchorElement).getAttribute("href"),
              title: (dom as HTMLAnchorElement).getAttribute("title"),
            };
          },
        },
      ],
      toDOM(node) {
        const { href, title } = node.attrs;
        return ["a", { href: href as string, title: title as string }, 0];
      },
    },
  },
});

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
  console.log(parsedContent);
  console.log(doc);

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

  console.log("editorState.doc", editorState.doc);

  return (
    <div>
      <ProseMirror
        mount={mount}
        state={editorState}
        dispatchTransaction={(tr) => {
          setEditorState((s) => s.apply(tr));
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
  );
}
