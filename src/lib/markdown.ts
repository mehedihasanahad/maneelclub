/**
 * Minimal Markdown renderer for blog post bodies.
 *
 * Deliberately hand-rolled rather than pulling in a parser: the blog needs
 * headings, paragraphs, lists, links, images, bold/italic, blockquotes and
 * code - nothing that justifies a dependency in a storefront bundle.
 *
 * Security: every `<` in the source is escaped before any Markdown is parsed,
 * so raw HTML in post content can never reach the page. Post bodies are written
 * by admins, but an admin account is not a reason to allow stored XSS.
 */

/** Escape the characters that could start a tag or an entity. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Only http(s) and site-relative URLs; blocks javascript: and data: URLs. */
function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return null;
}

/** Inline formatting, applied to already-escaped text. */
function renderInline(text: string): string {
  let out = text;

  // Images before links: both start with "[" once the "!" is consumed.
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, src) => {
    const url = safeUrl(src);
    return url
      ? `<img src="${url}" alt="${alt}" loading="lazy" />`
      : escapeHtml(match);
  });

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => {
    const url = safeUrl(href);
    if (!url) return escapeHtml(match);
    const external = /^https?:\/\//i.test(url);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${url}"${attrs}>${label}</a>`;
  });

  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  return out;
}

/**
 * Render Markdown to HTML.
 *
 * The output is safe to pass to dangerouslySetInnerHTML: the input is escaped
 * first and every generated tag is produced by this function.
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown?.trim()) return "";

  const lines = escapeHtml(markdown).replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];

  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Fenced code blocks are emitted verbatim (already escaped).
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        html.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        closeList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      closeList();
      // The post title is the page h1, so body headings are clamped to h2 and
      // below. Levels are otherwise kept as written: authors conventionally use
      // "##" for sections, and demoting that to h3 would skip a level under the
      // h1. "#" and "##" therefore both render as h2.
      const level = Math.min(Math.max(heading[1].length, 2), 6);
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph();
      closeList();
      html.push("<hr />");
      continue;
    }

    if (trimmed.startsWith("&gt; ")) {
      flushParagraph();
      closeList();
      html.push(`<blockquote><p>${renderInline(trimmed.slice(5))}</p></blockquote>`);
      continue;
    }

    const unordered = /^[-*]\s+(.*)$/.exec(trimmed);
    if (unordered) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${renderInline(unordered[1])}</li>`);
      continue;
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  if (inCodeBlock && codeLines.length) {
    html.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
  }
  flushParagraph();
  closeList();

  return html.join("\n");
}

/** Plain text, for excerpts and meta descriptions. */
export function markdownToPlainText(markdown: string, maxLength = 160): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
}
