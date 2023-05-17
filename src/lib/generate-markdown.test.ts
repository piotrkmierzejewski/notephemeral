import { describe, it, expect } from "vitest";

import { generateMarkdown } from "./generate-markdown";
import { schema } from "./schema";

describe("generateMarkdown", () => {
  it("should transform simple paragraph", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("Hello, world!")]),
    ]);
    const markdown = generateMarkdown(doc);
    expect(markdown).toEqual("Hello, world!\n\n");
  });

  it("should transform heading", () => {
    const doc = schema.node("doc", null, [
      schema.node("heading", { level: 2 }, [schema.text("## Hello, world!")]),
    ]);
    const markdown = generateMarkdown(doc);
    expect(markdown).toEqual("## Hello, world!\n\n");
  });

  it("should transform paragraph with hard breaks", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("Hello"),
        schema.node("hard_break"),
        schema.text("world"),
      ]),
    ]);
    const markdown = generateMarkdown(doc);
    expect(markdown).toEqual("Hello\nworld\n\n");
  });

  it("should transform links to plain URLs", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("Hello, "),
        schema.text("https://example.com", [
          schema.mark("link", { href: "https://example.com" }),
        ]),
        schema.text("!"),
      ]),
    ]);
    const markdown = generateMarkdown(doc);
    expect(markdown).toEqual("Hello, https://example.com!\n\n");
  });

  it("should handle mixed content within a paragraph", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("Hello, "),
        schema.text("https://example.com", [
          schema.mark("link", { href: "https://example.com" }),
        ]),
        schema.node("hard_break"),
        schema.text("world!"),
      ]),
    ]);
    const markdown = generateMarkdown(doc);
    expect(markdown).toEqual("Hello, https://example.com\nworld!\n\n");
  });
});
