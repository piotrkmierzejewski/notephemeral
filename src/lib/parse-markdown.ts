interface BaseAstNode {
  type: string;
}

interface HeadingAstNode extends BaseAstNode {
  type: "heading";
  level: number;
  content: string;
}

interface LineBreakAstNode extends BaseAstNode {
  type: "lineBreak";
}

interface URLAstNode extends BaseAstNode {
  type: "url";
  content: string;
}

interface TextAstNode extends BaseAstNode {
  type: "text";
  content: string;
}

type AstNode = HeadingAstNode | LineBreakAstNode | URLAstNode | TextAstNode;

const urlPattern =
  /\b((?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])\b/gi;

const parseHeading = (input: string): HeadingAstNode => {
  const level = (input.match(/#/g) || []).length;
  return {
    type: "heading",
    level: level,
    content: input.trim(),
  };
};

const parseLineBreak = (): LineBreakAstNode => ({ type: "lineBreak" });

const parseText = (input: string): TextAstNode => ({
  type: "text",
  content: input,
});

const parseURL = (input: string): URLAstNode => ({
  type: "url",
  content: input,
});

export const parseMarkdown = (input: string): AstNode[] => {
  const lines = input.split("\n");
  const ast: AstNode[] = [];

  lines.forEach((line, i) => {
    // Process headings
    if (line.startsWith("#")) {
      ast.push(parseHeading(line));
    }
    // Process urls and text
    else {
      let match;
      let lastIdx = 0;
      while ((match = urlPattern.exec(line)) !== null) {
        const matchedURL = match[0];
        const urlStartIdx = match.index;
        if (urlStartIdx > lastIdx) {
          // Add preceding text if it exists
          ast.push(parseText(line.slice(lastIdx, urlStartIdx)));
        }
        ast.push(parseURL(matchedURL));
        lastIdx = urlStartIdx + matchedURL.length;
      }
      if (lastIdx < line.length) {
        // Add remaining text if it exists
        ast.push(parseText(line.slice(lastIdx)));
      }
    }

    // Process line breaks
    if (i < lines.length - 1) {
      ast.push(parseLineBreak());
    }
  });

  return ast;
};
