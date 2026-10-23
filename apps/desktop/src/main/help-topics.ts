import type { HelpTopic } from '@smart-terminal/contracts';

/** Closed mapping from in-app help topics to repository documentation. */
export const HELP_URLS: Record<HelpTopic, string> = {
  repository: 'https://github.com/FVilli/my-smart-terminal/blob/main/docs/18%20-%20Repository%20setup%20guide.md',
  ai: 'https://github.com/FVilli/my-smart-terminal/blob/main/docs/19%20-%20AI%20provider%20setup%20guide.md',
  stt: 'https://github.com/FVilli/my-smart-terminal/blob/main/docs/17%20-%20STT%20setup%20guide.md',
  troubleshooting: 'https://github.com/FVilli/my-smart-terminal/blob/main/docs/12%20-%20User%20manual.md',
};
