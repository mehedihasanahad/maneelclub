import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, markdownToPlainText } from "./markdown";

describe("renderMarkdown - security", () => {
  it("escapes raw HTML so script tags can never reach the page", () => {
    const out = renderMarkdown('<script>alert("xss")</script>');
    assert.ok(!out.includes("<script"), "script tag must not survive");
    assert.ok(out.includes("&lt;script&gt;"));
  });

  it("escapes inline event handlers", () => {
    const out = renderMarkdown('<img src=x onerror="alert(1)">');
    // The text may still read "onerror=" - what matters is that it is inert
    // escaped text, not a real attribute on a real tag.
    assert.ok(!out.includes("<img"), "must not emit an img tag");
    assert.ok(out.includes("&lt;img"), "the tag must be escaped");
    assert.ok(!/onerror\s*=\s*["']/.test(out.replace(/&quot;/g, '"')) || !out.includes("<img"));
  });

  it("rejects javascript: links, keeping the text visible", () => {
    const out = renderMarkdown("[click](javascript:alert(1))");
    // "javascript:" may remain as visible text; it must never be an href.
    assert.ok(!/href\s*=\s*"javascript:/i.test(out), "must not emit a javascript: href");
    assert.ok(!out.includes("<a "), "no anchor at all for a rejected URL");
    assert.ok(out.includes("click"));
  });

  it("rejects data: image sources", () => {
    const out = renderMarkdown("![x](data:text/html;base64,PHNjcmlwdD4=)");
    assert.ok(!out.includes("<img"), "must not emit an img for a data: URL");
  });

  it("allows http(s) and site-relative URLs", () => {
    assert.ok(renderMarkdown("[a](https://example.com)").includes('href="https://example.com"'));
    assert.ok(renderMarkdown("[a](/shop)").includes('href="/shop"'));
  });

  it("marks external links noopener", () => {
    const out = renderMarkdown("[a](https://example.com)");
    assert.ok(out.includes('rel="noopener noreferrer"'));
    // Internal links stay plain.
    assert.ok(!renderMarkdown("[a](/shop)").includes("noopener"));
  });
});

describe("renderMarkdown - formatting", () => {
  it("clamps body headings to h2 so the post title keeps the only h1", () => {
    assert.equal(renderMarkdown("# Top"), "<h2>Top</h2>");
    // "##" is the conventional section heading in a post body; it must stay h2
    // rather than becoming h3, which would skip a level under the h1.
    assert.equal(renderMarkdown("## Section"), "<h2>Section</h2>");
    assert.equal(renderMarkdown("### Sub"), "<h3>Sub</h3>");
    assert.equal(renderMarkdown("#### Deeper"), "<h4>Deeper</h4>");
  });

  it("groups consecutive lines into one paragraph", () => {
    assert.equal(renderMarkdown("one\ntwo"), "<p>one two</p>");
  });

  it("splits paragraphs on a blank line", () => {
    assert.equal(renderMarkdown("one\n\ntwo"), "<p>one</p>\n<p>two</p>");
  });

  it("renders unordered and ordered lists", () => {
    assert.equal(renderMarkdown("- a\n- b"), "<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
    assert.equal(renderMarkdown("1. a\n2. b"), "<ol>\n<li>a</li>\n<li>b</li>\n</ol>");
  });

  it("renders bold, italic and inline code", () => {
    assert.ok(renderMarkdown("**bold**").includes("<strong>bold</strong>"));
    assert.ok(renderMarkdown("*it*").includes("<em>it</em>"));
    assert.ok(renderMarkdown("`code`").includes("<code>code</code>"));
  });

  it("renders blockquotes (the > is escaped before parsing)", () => {
    assert.equal(renderMarkdown("> quoted"), "<blockquote><p>quoted</p></blockquote>");
  });

  it("returns an empty string for empty input", () => {
    assert.equal(renderMarkdown(""), "");
    assert.equal(renderMarkdown("   "), "");
  });
});

describe("markdownToPlainText", () => {
  it("strips markup for use in meta descriptions", () => {
    assert.equal(markdownToPlainText("# Title\n\nSome **bold** text."), "Title Some bold text.");
  });

  it("truncates on a word boundary", () => {
    const out = markdownToPlainText("one two three four five", 12);
    assert.ok(out.endsWith("..."));
    assert.ok(out.length <= 15);
  });
});
