import { describe, expect, it } from 'vitest';
import { isAllowedNavigation } from './navigation';
import { resolveRendererPath } from './renderer-path';

describe('navigation hardening', () => {
  it('allows only the configured origin', () => {
    expect(isAllowedNavigation('http://127.0.0.1:4200/index.html', 'http://127.0.0.1:4200', 'smart-terminal', 'bundle')).toBe(true);
    expect(isAllowedNavigation('http://127.0.0.1:4200.evil.example/', 'http://127.0.0.1:4200', 'smart-terminal', 'bundle')).toBe(false);
    expect(isAllowedNavigation('smart-terminal://bundle/index.html', undefined, 'smart-terminal', 'bundle')).toBe(true);
    expect(isAllowedNavigation('smart-terminal://bundle.evil/index.html', undefined, 'smart-terminal', 'bundle')).toBe(false);
    expect(isAllowedNavigation('javascript:alert(1)', undefined, 'smart-terminal', 'bundle')).toBe(false);
  });

  it('rejects traversal, encoded traversal and malformed URIs', () => {
    const root = '/app/dist';
    expect(resolveRendererPath(root, '/index.html')).toBe('/app/dist/index.html');
    expect(resolveRendererPath(root, '/assets/app.js')).toBe('/app/dist/assets/app.js');
    expect(resolveRendererPath(root, '/../secret')).toBeNull();
    expect(resolveRendererPath(root, '/%2e%2e/secret')).toBeNull();
    expect(resolveRendererPath(root, '/%2fetc%2fpasswd')).toBeNull();
    expect(resolveRendererPath(root, '/%00index.html')).toBeNull();
    expect(resolveRendererPath(root, '/%E0%A4%A')).toBeNull();
  });
});
