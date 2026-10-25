import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../apps/renderer/src/app/ui/markdown.logic';

describe('renderMarkdown', () => {
  it('escapes HTML and quotes without raw HTML injection', () => { expect(renderMarkdown(`<script title="x">'&</script>`)).toBe('<p>&lt;script title=&quot;x&quot;&gt;&#39;&amp;&lt;/script&gt;</p>'); });
  it('renders fenced and inline code safely', () => { expect(renderMarkdown('```ts\n<x>&\n```')).toContain('<pre><code class="language-ts">&lt;x&gt;&amp;</code></pre>'); expect(renderMarkdown('`<x>`')).toContain('<code>&lt;x&gt;</code>'); });
  it('renders block structures and emphasis', () => { const html = renderMarkdown('# Title\n- one\n1. two\n> quote\n**bold** *italic* _also_'); expect(html).toContain('<h1>Title</h1>'); expect(html).toContain('<ul>'); expect(html).toContain('<ol>'); expect(html).toContain('<blockquote>'); expect(html).toContain('<strong>bold</strong>'); expect(html).toContain('<em>italic</em>'); });
  it('links only http(s) with safe attributes', () => { expect(renderMarkdown('[ok](https://example.test)')).toContain('target="_blank" rel="noreferrer noopener"'); expect(renderMarkdown('[bad](javascript:alert(1))')).not.toContain('href='); expect(renderMarkdown('[bad](data:text/html,x)')).toContain('bad'); });
  it('handles empty and plain text deterministically', () => { expect(renderMarkdown('')).toBe(''); expect(renderMarkdown('plain\ntext')).toBe('<p>plain<br>text</p>'); });
});
