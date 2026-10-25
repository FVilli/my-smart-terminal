export type TabsKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

export function nextTabIndex(current: number, length: number, key: string): number {
  if (length <= 0) return -1;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp': return (current - 1 + length) % length;
    case 'ArrowRight':
    case 'ArrowDown': return (current + 1) % length;
    case 'Home': return 0;
    case 'End': return length - 1;
    default: return -1;
  }
}

export interface TabItem { id: string; label: string; testId?: string; disabled?: boolean; }

/** Settings tabs (edit mode), in step order. */
export const SETTINGS_TABS: readonly TabItem[] = [
  { id: 'repository', label: 'Repository', testId: 'settings-tab-repository' },
  { id: 'ai', label: 'AI', testId: 'settings-tab-ai' },
  { id: 'stt', label: 'STT', testId: 'settings-tab-stt' },
  { id: 'appearance', label: 'Appearance', testId: 'settings-tab-appearance' },
];
