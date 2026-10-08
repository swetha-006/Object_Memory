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

  // Replace double pipes or loose table artifacts with list items
  text = text.replace(/\|\s*\|\s*/g, '\n- ');

  // Add line breaks before numbered list items that got smushed together (e.g. "...GPU. 2. **Charging...")
  text = text.replace(/([.!?])\s+(\d+\.\s+\*\*)/g, '$1\n\n$2');

  // Add line breaks before bold section headers like "...power draw. **Quick Fixes:**"
  text = text.replace(/([.!?])\s+(\*\*[A-Z][A-Za-z\s]+:\*\*)/g, '$1\n\n$2');

  // Add line breaks before bullet points smushed together (e.g. "...apps. * Remove the case.")
  text = text.replace(/([.!?])\s+(\*\s+)/g, '$1\n- ');

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
