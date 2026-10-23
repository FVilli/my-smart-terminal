import type { SmartTerminalApi } from '@smart-terminal/contracts';

declare global {
  interface Window {
    smartTerminal: SmartTerminalApi;
  }
}

export {};
