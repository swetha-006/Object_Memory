import React, { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked with GFM and line breaks preserved
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Normalizes run-on text from LLMs into clean Markdown structure
 * if the model returned sentences/lists without proper newlines.
 */
function cleanMarkdown(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.trim();

  // Strip unintended leading spaces from structural Markdown tags (e.g. "  1. **..." or "  ### ...")
  text = text.replace(/^[ \t]+(#{1,6}\s|\d+\.\s|[-*+]\s|>)/gm, '$1');

  // Replace double pipes or loose table artifacts with list items
  text = text.replace(/\|\s*\|\s*/g, '\n- ');

  // Add line breaks ONLY when numbered list items were smushed onto the same line without a newline
  // Requires a preceding letter ([a-zA-Z]) to prevent matching the dot in list numbers (e.g. "1.")
  text = text.replace(/([a-zA-Z][.!?])[ \t]+(\d+\.\s+)/g, '$1\n\n$2');

  // Add line breaks ONLY when bold section headers were smushed into a preceding sentence on the same line
  // Requires a preceding letter ([a-zA-Z]) to prevent breaking "1. **Title:**"
  text = text.replace(/([a-zA-Z][.!?])[ \t]+(\*\*[A-Z][A-Za-z0-9\s()&/\-]+:\*\*)/g, '$1\n\n$2');

  // Add line breaks when bullet points are smushed on the same line
  text = text.replace(/([a-zA-Z][.!?])[ \t]+([*-]\s+)/g, '$1\n- ');

  return text;
}


export function MarkdownView({ content, className = '' }) {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      const normalized = cleanMarkdown(content);
      return marked.parse(normalized);
    } catch (e) {
      console.warn('Markdown parse failed:', e);
      return content;
    }
  }, [content]);

  if (!content) return null;

  return (
    <div
      className={`markdownBody ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
