import { vi } from 'vitest';
import type { AppConfig } from '../app-config';

/**
 * Minimal config/secrets doubles shared by main-process service specs.
 * Callers keep their own `config()` defaults so each spec still states the
 * provider/token it exercises.
 */
export function stubStores(cfg: AppConfig | undefined, token: string | null) {
  return {
    configStore: {
      load: vi.fn(() =>
        cfg === undefined
          ? { status: 'missing' as const }
          : { status: 'valid' as const, config: cfg, restoredFromBackup: false },
      ),
    },
    secrets: {
      isSecure: vi.fn(() => true),
      has: vi.fn(() => token !== null),
      get: vi.fn(() => token ?? undefined),
    },
  };
}
