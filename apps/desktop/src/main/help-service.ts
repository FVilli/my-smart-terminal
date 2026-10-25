import { shell } from 'electron';
import type { HelpOpenResult, HelpTopic } from '@smart-terminal/contracts';
import { helpUrl, isAllowedHelpUrl } from './help-topics';

export function createHelpService(options: { openExternal?: (url: string) => Promise<unknown>; log?: (category: string) => void } = {}) {
  const openExternal = options.openExternal ?? ((url: string) => shell.openExternal(url));
  return {
    async open(topic: HelpTopic): Promise<HelpOpenResult> {
      const url = helpUrl(topic);
      if (!isAllowedHelpUrl(url)) throw Object.assign(new Error('Help URL rejected'), { code: 'HELP_URL_INVALID' });
      try {
        await openExternal(url);
        return { opened: true, url };
      } catch {
        options.log?.('external-open-failed');
        return { opened: false, url };
      }
    },
  };
}
