import { describe, expect, it } from 'vitest';
import { FrontmatterError, parseFrontmatter, serializeFrontmatter, splitKnownFields } from './frontmatter';

describe('frontmatter', () => {
  it('roundtrips scalars including tricky strings', () => {
    const data = {
      plain: 'abc',
      colon: 'a: b',
      hash: 'x # y',
      newline: 'riga1\nriga2',
      unicode: 'São Paulo · 日本語 🚀',
      quote: `it's "q"`,
      numberLike: '42',
      boolLike: 'true',
      nullLike: 'null',
      empty: '',
      path: '/home/user/dir',
      int: 7,
      float: -1.5,
      yes: true,
      no: false,
      nothing: null,
    };
    const text = serializeFrontmatter(data, '\nbody\n');
    expect(parseFrontmatter(text)).toEqual({ hasFrontmatter: true, data, body: '\nbody\n' });
  });

  it('treats a file without frontmatter as body only', () => {
    expect(parseFrontmatter('# Titolo\n')).toEqual({ hasFrontmatter: false, data: {}, body: '# Titolo\n' });
  });

  it('parses single-quoted values, comments and CRLF', () => {
    const parsed = parseFrontmatter("---\r\n# nota\r\na: 'it''s'\r\nb: 3\r\n---\r\nbody");
    expect(parsed.data).toEqual({ a: "it's", b: 3 });
    expect(parsed.body).toBe('body');
  });

  it.each([
    ['---\na: 1\n', 'FRONTMATTER_UNTERMINATED'],
    ['---\na: 1\na: 2\n---\n', 'FRONTMATTER_DUPLICATE_KEY'],
    ['---\nnot a pair\n---\n', 'FRONTMATTER_INVALID_LINE'],
    ['---\n1bad: 1\n---\n', 'FRONTMATTER_INVALID_KEY'],
    ['---\na: [1, 2]\n---\n', 'FRONTMATTER_INVALID_VALUE'],
    ['---\na: "broken\n---\n', 'FRONTMATTER_INVALID_VALUE'],
    ['---\n  a: 1\n---\n', 'FRONTMATTER_INVALID_LINE'],
  ])('rejects invalid frontmatter %#', (text, code) => {
    expect(() => parseFrontmatter(text)).toThrow(expect.objectContaining({ code }));
  });

  it('rejects invalid keys and non-finite numbers when serializing', () => {
    expect(() => serializeFrontmatter({ 'bad key': 1 })).toThrow(FrontmatterError);
    expect(() => serializeFrontmatter({ a: Number.NaN })).toThrow(FrontmatterError);
  });

  it('preserves or rejects unknown fields', () => {
    const data = { a: 1, future: 'x' };
    expect(splitKnownFields(data, ['a'], 'preserve')).toEqual({ known: { a: 1 }, extra: { future: 'x' } });
    expect(() => splitKnownFields(data, ['a'], 'reject')).toThrow(expect.objectContaining({ code: 'FRONTMATTER_UNKNOWN_FIELD' }));
  });

  it('does not allow prototype pollution via keys', () => {
    const parsed = parseFrontmatter('---\n__proto__: 1\n---\n');
    expect(Object.getPrototypeOf(parsed.data)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
    expect(Object.keys(parsed.data)).toEqual(['__proto__']);
  });
});
