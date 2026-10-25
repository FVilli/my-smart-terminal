export function renderMarkdown(text: string): string {
  const escape = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const inline = (source: string): string => {
    let value = escape(source);
    value = value.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    value = value.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_match, label: string, url: string) => /^https?:\/\//i.test(url) ? `<a href="${url}" target="_blank" rel="noreferrer noopener">${label}</a>` : label);
    value = value.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    value = value.replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/_([^_\n]+)_/g, '<em>$1</em>');
    return value;
  };
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = []; let paragraph: string[] = []; let list: 'ul' | 'ol' | null = null;
  const flushParagraph = () => { if (paragraph.length) { out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const fence = /^```([^\s`]*)\s*$/.exec(line);
    if (fence) { flushParagraph(); closeList(); const code: string[] = []; i++; while (i < lines.length && !/^```\s*$/.test(lines[i] ?? '')) code.push(lines[i++] ?? ''); const lang = (fence[1] ?? '').replace(/[^a-zA-Z0-9_-]/g, ''); out.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escape(code.join('\n'))}</code></pre>`); continue; }
    if (!line.trim()) { flushParagraph(); closeList(); continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { flushParagraph(); closeList(); const n = heading[1]!.length; out.push(`<h${n}>${inline(heading[2]!)}</h${n}>`); continue; }
    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) { flushParagraph(); closeList(); out.push('<hr>'); continue; }
    if (/^>\s?/.test(line)) { flushParagraph(); closeList(); out.push(`<blockquote><p>${inline(line.replace(/^>\s?/, ''))}</p></blockquote>`); continue; }
    const item = /^\s*(?:([-*])\s+|(\d+)\.\s+)(.*)$/.exec(line);
    if (item) { flushParagraph(); const kind = item[2] ? 'ol' : 'ul'; if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; } out.push(`<li>${inline(item[3] ?? '')}</li>`); continue; }
    closeList(); paragraph.push(line);
  }
  flushParagraph(); closeList(); return out.join('\n');
}
