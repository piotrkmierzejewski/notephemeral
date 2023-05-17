import { type Node as ProseMirrorNode } from "prosemirror-model";

export const generateMarkdown = (node: ProseMirrorNode): string => {
  let markdown = "";
  node.forEach((childNode) => {
    const nodeType = childNode.type.name;
    switch (nodeType) {
      case "heading": {
        markdown += `${childNode.textContent}\n\n`;
        break;
      }
      case "paragraph": {
        let paragraphText = "";
        childNode.forEach((inlineNode) => {
          if (inlineNode.type.name === "hard_break") {
            paragraphText += "\n";
          } else {
            const linkMark = inlineNode.marks.find(
              (mark) => mark.type.name === "link"
            );
            const text = linkMark
              ? (linkMark.attrs.href as string)
              : inlineNode.textContent;
            paragraphText += text;
          }
        });
        markdown += `${paragraphText}\n\n`;
        break;
      }
      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }
  });
  return markdown;
};
