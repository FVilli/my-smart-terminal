import { describe, expect, it } from 'vitest';
import { formatWindowTitle, resolveWindowIcon } from './window-branding';

describe('window branding', () => {
  it('formats the title from the runtime version', () => {
    expect(formatWindowTitle('1.1.1')).toBe('Smart Terminal - Version 1.1.1');
  });

  it('uses the source icon in development and the extra resource when packaged', () => {
    expect(resolveWindowIcon(false, '/resources', '/project')).toBe('/project/apps/desktop/build/icon-linux.png');
    expect(resolveWindowIcon(true, '/resources', '/project')).toBe('/resources/icon.png');
  });
});
