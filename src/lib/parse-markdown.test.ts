import { describe, it, expect } from "vitest";

import { parseMarkdown } from "./parse-markdown";

describe("parseMarkdown", () => {
  it("should parse text without links and headings", () => {
    const input = "This is a test string without links or headings.";
    const expectedResult = [[{ type: "text", content: input }]];

    expect(parseMarkdown(input)).toEqual(expectedResult);
  });

  it("should parse text with links", () => {
    const input = "This is a test string with a link: https://example.com.";
    const expectedResult = [
      [
        { type: "text", content: "This is a test string with a link: " },
        { type: "url", content: "https://example.com" },
        { type: "text", content: "." },
      ],
    ];

    expect(parseMarkdown(input)).toEqual(expectedResult);
  });

  it("should parse text with headings", () => {
    const input = "# Heading 1\n\nThis is a test string with a heading.";
    const expectedResult = [
      [{ type: "heading", level: 1, content: "# Heading 1" }],

      [{ type: "text", content: "This is a test string with a heading." }],
    ];

    expect(parseMarkdown(input)).toEqual(expectedResult);
  });

  it("should parse text with links and headings", () => {
    const input =
      "# Heading 1\n\nThis is a test string with a [link](https://example.com) and a heading.";
    const expectedResult = [
      [{ type: "heading", level: 1, content: "# Heading 1" }],

      [
        { type: "text", content: "This is a test string with a [link](" },
        { type: "url", content: "https://example.com" },
        { type: "text", content: ") and a heading." },
      ],
    ];

    expect(parseMarkdown(input)).toEqual(expectedResult);
  });

  it("should parse text with line breaks", () => {
    const input = "This is a test\nstring with a line break.";
    const expectedResult = [
      [
        { type: "text", content: "This is a test" },
        { type: "lineBreak" },
        { type: "text", content: "string with a line break." },
      ],
    ];

    expect(parseMarkdown(input)).toEqual(expectedResult);
  });

  it("should parse text with multiple line breaks", () => {
    const input = "This is a test\n\nstring with multiple\nline breaks.";
    const expectedResult = [
      [{ type: "text", content: "This is a test" }],
      [
        { type: "text", content: "string with multiple" },
        { type: "lineBreak" },
        { type: "text", content: "line breaks." },
      ],
    ];

    expect(parseMarkdown(input)).toEqual(expectedResult);
  });

  it("should parse text with line breaks, links, and headings", () => {
    const input =
      "# Heading 1\n\nThis is a test string with a [link](https://example.com)\nand a heading.";
    const expectedResult = [
      [{ type: "heading", level: 1, content: "# Heading 1" }],

      [
        { type: "text", content: "This is a test string with a [link](" },
        { type: "url", content: "https://example.com" },
        { type: "text", content: ")" },
        { type: "lineBreak" },
        { type: "text", content: "and a heading." },
      ],
    ];

    expect(parseMarkdown(input)).toEqual(expectedResult);
  });
  it("should handle empty input", () => {
    const input = "";
    const ast = parseMarkdown(input);
    expect(ast).toEqual([]);
  });

  it("should handle input with only line breaks", () => {
    const input = "\n\n";
    const ast = parseMarkdown(input);
    expect(ast).toEqual([]);
  });

  it("should handle input with URLs at the beginning and end of the line", () => {
    const input =
      "https://google.com\nGo to Google and Bing.\nhttps://bing.com";
    const ast = parseMarkdown(input);
    expect(ast).toEqual([
      [
        { type: "url", content: "https://google.com" },
        { type: "lineBreak" },
        { type: "text", content: "Go to Google and Bing." },
        { type: "lineBreak" },
        { type: "url", content: "https://bing.com" },
      ],
    ]);
  });

  it("should handle input with consecutive URLs", () => {
    const input = "https://google.com https://bing.com";
    const ast = parseMarkdown(input);
    expect(ast).toEqual([
      [
        { type: "url", content: "https://google.com" },
        { type: "text", content: " " },
        { type: "url", content: "https://bing.com" },
      ],
    ]);
  });

  it("should handle input with a URL followed by a heading", () => {
    const input = "https://google.com\n# Heading";
    const ast = parseMarkdown(input);
    expect(ast).toEqual([
      [
        { type: "url", content: "https://google.com" },
        { type: "lineBreak" },
        { type: "heading", level: 1, content: "# Heading" },
      ],
    ]);
  });

  it("should handle input with a URL surrounded by text", () => {
    const input = "Go to https://google.com for more information.";
    const ast = parseMarkdown(input);
    expect(ast).toEqual([
      [
        { type: "text", content: "Go to " },
        { type: "url", content: "https://google.com" },
        { type: "text", content: " for more information." },
      ],
    ]);
  });

  it("should handle input with a URL at the end of a line followed by a line break", () => {
    const input = "Go to https://google.com\nFor more information.";
    const ast = parseMarkdown(input);
    expect(ast).toEqual([
      [
        { type: "text", content: "Go to " },
        { type: "url", content: "https://google.com" },
        { type: "lineBreak" },
        { type: "text", content: "For more information." },
      ],
    ]);
  });
});
