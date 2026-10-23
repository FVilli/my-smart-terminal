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
  const box = (selector) => { const el = document.querySelector(selector); return el ? el.getBoundingClientRect() : null; };
  const bg = (selector) => { const el = document.querySelector(selector); return el ? getComputedStyle(el).backgroundColor : null; };
  const activeTab = document.querySelector('[data-testid="session-tab"][aria-selected="true"]');
  return { viewportWidth, scrollWidth, clientWidth, sidebarLeft, sidebarWidth, sidebarOverflow,
    ratio: viewportWidth ? sidebarLeft / viewportWidth : 0, overflow,
    headerHeight: box('app-header')?.height ?? 0,
    tabBarHeight: box('app-session-tabs')?.height ?? 0,
    inputHeight: box('app-assisted-input')?.height ?? 0,
    footerHeight: box('app-status-footer')?.height ?? 0,
    activeTabBg: activeTab ? getComputedStyle(activeTab).backgroundColor : null,
    sidebarBg: bg('app-sidebar-panel'),
    sidebarCardBg: bg('[data-testid="sidebar-entry"]'),
    terminalBg: bg('app-terminal-workarea'),
    inputBg: bg('app-assisted-input') };
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

/** Capture mode (SMART_TERMINAL_CAPTURE=/path.png): prepares an optional real UI scenario, saves a screenshot, prints DOM metrics, exits 0 only without overflow. */
export function runCapture(window: BrowserWindow, outputPath: string): void {
  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        const scenario = process.env['SMART_TERMINAL_CAPTURE_SCENARIO'] ?? '';
        const script = `(async () => {
          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const waitFor = async (predicate, timeoutMs = 10000) => {
            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
              if (await predicate()) return true;
              await sleep(100);
            }
            return false;
          };
          const q = (id) => document.querySelector('[data-testid="' + id + '"]');
          const click = (id) => { const el = q(id); if (el) el.click(); return !!el; };
          if (${JSON.stringify(scenario)} === 'onboarding') {
            await waitFor(() => q('onboarding-overlay'));
          }
          if (${JSON.stringify(scenario)} === 'onboarding-ai') {
            await waitFor(() => q('onboarding-overlay'));
            click('onboarding-next');
            await waitFor(() => q('onboarding-progress')?.textContent.includes('Step 2 of 3'));
            const provider = q('onboarding-ai-provider');
            if (provider) { provider.value = 'openai-compatible'; provider.dispatchEvent(new Event('change', { bubbles: true })); }
            await waitFor(() => q('onboarding-ai-url'));
          }
          if (${JSON.stringify(scenario)} === 'onboarding-stt') {
            await waitFor(() => q('onboarding-overlay'));
            click('onboarding-next');
            await waitFor(() => q('onboarding-progress')?.textContent.includes('Step 2 of 3'));
            click('onboarding-next');
            await waitFor(() => q('onboarding-progress')?.textContent.includes('Step 3 of 3'));
            const provider = q('onboarding-stt-provider');
            if (provider) { provider.value = 'local'; provider.dispatchEvent(new Event('change', { bubbles: true })); }
            await waitFor(() => q('onboarding-stt-command'));
          }
          if (${JSON.stringify(scenario)} === 'tabs') {
            await waitFor(() => q('session-tab'));
            click('session-plus');
            await waitFor(() => q('session-new-local'));
            click('session-new-local');
            await waitFor(() => document.querySelectorAll('[data-testid="session-tab"]').length >= 2);
          }
          if (${JSON.stringify(scenario)} === 'ssh-menu') {
            await waitFor(() => q('session-tab'));
            await sleep(500);
            click('session-plus');
            await waitFor(() => q('session-new-ssh') && !q('session-new-ssh').disabled, 5000);
          }
          if (${JSON.stringify(scenario)} === 'ai-review') {
            await waitFor(() => q('assisted-textarea') && !q('assisted-textarea').disabled);
            const input = q('assisted-textarea');
            const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
            setter.call(input, 'This is a sentance with a typo');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(300);
            click('ai-correction');
            await waitFor(() => q('ai-notice') && q('ai-notice').textContent.includes('review'), 8000);
          }
          if (${JSON.stringify(scenario)} === 'history') {
            await waitFor(() => q('sidebar-tab-history'));
            click('sidebar-tab-history');
            await waitFor(() => document.querySelectorAll('[data-testid="sidebar-entry"]').length > 0, 10000);
          }
          if (${JSON.stringify(scenario)} === 'clipboard') {
            await waitFor(() => q('sidebar-tab-clipboard'));
            click('sidebar-tab-clipboard');
            await waitFor(() => q('clipboard-enable'));
            if (q('clipboard-enable') && !q('clipboard-enable').checked) q('clipboard-enable').click();
            await waitFor(() => q('clipboard-status') && q('clipboard-status').textContent.includes('Clipboard capture on'), 5000);
            await waitFor(() => document.querySelectorAll('[data-testid="sidebar-entry"]').length > 0, 10000);
          }
          const checks = {};
          if (${JSON.stringify(scenario)} === 'onboarding') checks['onboardingVisible'] = !!q('onboarding-overlay');
          if (${JSON.stringify(scenario)} === 'onboarding-ai') checks['onboardingAiStep'] = (q('onboarding-progress')?.textContent ?? '').includes('Step 2 of 3') && !!q('onboarding-ai-url');
          if (${JSON.stringify(scenario)} === 'onboarding-stt') checks['onboardingSttStep'] = (q('onboarding-progress')?.textContent ?? '').includes('Step 3 of 3') && !!q('onboarding-stt-command');
          if (${JSON.stringify(scenario)} === 'tabs') checks['twoTabs'] = document.querySelectorAll('[data-testid="session-tab"]').length >= 2;
          if (${JSON.stringify(scenario)} === 'ssh-menu') checks['sshMenuOpen'] = !!q('session-new-ssh') && !q('session-new-ssh').disabled;
          if (${JSON.stringify(scenario)} === 'ai-review') checks['aiReviewVisible'] = !!q('ai-notice') && q('ai-notice').textContent.includes('review');
          if (${JSON.stringify(scenario)} === 'history') checks['historyEntries'] = document.querySelectorAll('[data-testid="sidebar-entry"]').length > 0;
          if (${JSON.stringify(scenario)} === 'clipboard') checks['clipboardRecorded'] = document.querySelectorAll('[data-testid="sidebar-entry"]').length > 0 && !!q('clipboard-status') && q('clipboard-status').textContent.includes('Clipboard capture on');
          await sleep(800);
          return checks;
        })()`;
        let scenarioOk = true;
        if (scenario) {
          const checks = (await window.webContents.executeJavaScript(script)) as Record<string, boolean>;
          scenarioOk = Object.values(checks).every((value) => value === true);
          console.log('SMART_TERMINAL_CAPTURE_SCENARIO_RESULT', JSON.stringify({ scenario, ...checks, ok: scenarioOk }));
        }
        const metrics = (await window.webContents.executeJavaScript(METRICS_SCRIPT)) as { overflow: boolean };
        const image = await window.webContents.capturePage();
        fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
        fs.writeFileSync(outputPath, image.toPNG());
        console.log('SMART_TERMINAL_LAYOUT_RESULT', JSON.stringify(metrics));
        app.exit(metrics.overflow || !scenarioOk ? 1 : 0);
      })().catch((error: unknown) => {
        console.error('SMART_TERMINAL_CAPTURE_ERROR', error);
        app.exit(1);
      });
    }, 1500);
  });
}
