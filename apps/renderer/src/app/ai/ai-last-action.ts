const KEY = 'smart-terminal.ai-last-action';

export interface LastActionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readLastAction(storage: LastActionStorage): string | null {
  try {
    const id = storage.getItem(KEY);
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export function writeLastAction(storage: LastActionStorage, id: string): void {
  try {
    storage.setItem(KEY, id);
  } catch {
    // Persistence is best-effort; action selection must still work.
  }
}
