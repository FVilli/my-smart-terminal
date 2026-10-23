import { app, type BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const METRICS_SCRIPT = `(() => {
  const root = document.documentElement;
  const sidebar = document.querySelector('[data-testid="sidebar"]');
  const rect = sidebar ? sidebar.getBoundingClientRect() : null;
  const viewportWidth = window.innerWidth;
  const scrollWidth = root.scrollWidth;
  const clientWidth = root.clientWidth;
  const sidebarLeft = rect ? rect.left : 0;
  const sidebarWidth = rect ? rect.width : 0;
  const panel = document.querySelector('app-sidebar-panel');
  const sidebarOverflow = !!sidebar && (sidebar.scrollWidth > sidebar.clientWidth ||
    (!!panel && (panel.scrollWidth > panel.clientWidth || panel.scrollHeight > panel.clientHeight)));
  const overflow = sidebarOverflow || scrollWidth > clientWidth || document.body.scrollWidth > document.body.clientWidth ||
    root.scrollHeight > root.clientHeight || !rect;
  return { viewportWidth, scrollWidth, clientWidth, sidebarLeft, sidebarWidth, sidebarOverflow,
    ratio: viewportWidth ? sidebarLeft / viewportWidth : 0, overflow };
})()`;

/** Window dimensions from SMART_TERMINAL_WINDOW_WIDTH/HEIGHT (default 1440x900). */
export function readWindowSize(): { width: number; height: number } {
  const parse = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    width: parse(process.env['SMART_TERMINAL_WINDOW_WIDTH'], 1440),
    height: parse(process.env['SMART_TERMINAL_WINDOW_HEIGHT'], 900),
  };
}

/** Capture mode (SMART_TERMINAL_CAPTURE=/path.png): saves a screenshot, prints DOM metrics, and exits 0 only without overflow. */
export function runCapture(window: BrowserWindow, outputPath: string): void {
  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        const metrics = (await window.webContents.executeJavaScript(METRICS_SCRIPT)) as { overflow: boolean };
        const image = await window.webContents.capturePage();
        fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
        fs.writeFileSync(outputPath, image.toPNG());
        console.log('SMART_TERMINAL_LAYOUT_RESULT', JSON.stringify(metrics));
        app.exit(metrics.overflow ? 1 : 0);
      })().catch((error: unknown) => {
        console.error('SMART_TERMINAL_CAPTURE_ERROR', error);
        app.exit(1);
      });
    }, 1500);
  });
}
