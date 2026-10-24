import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { AiStore } from './ai/ai-store';
import { AppearanceStore } from './appearance/appearance-store';
import { ClipboardCaptureStore } from './clipboard-capture/clipboard-capture-store';
import type { SidebarTab } from './session.model';
import { AssistedInput } from './assisted-input/assisted-input';
import { OnboardingWizard } from './onboarding/onboarding-wizard';
import { AppHeader } from './header/app-header';
import { SessionTabs } from './session-tabs/session-tabs';
import { SearchStore } from './search/search-store';
import { SessionsStore } from './sessions-store';
import { LayoutStore } from './layout-store';
import { SttStore } from './stt/stt-store';
import { SidebarPanel } from './sidebar-panel/sidebar-panel';
import { StatusFooter } from './status-footer/status-footer';
import { SyncStatusStore } from './sync-status/sync-status-store';
import { TerminalPanel } from './terminal-panel';
import { TerminalWorkarea } from './terminal-workarea/terminal-workarea';

@Component({
  selector: 'app-root',
  imports: [OnboardingWizard, AppHeader, SessionTabs, TerminalWorkarea, TerminalPanel, AssistedInput, SidebarPanel, StatusFooter],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly store = inject(SessionsStore);
  protected readonly layout = inject(LayoutStore);

  protected setPanel(tab: SidebarTab | null): void {
    this.layout.set(tab);
    if (tab !== null) this.search.setTab(tab);
  }
  /** Active tab awaiting close confirmation (non-blocking inline dialog). */
  protected readonly pendingCloseId = signal<string | null>(null);

  protected readonly search = inject(SearchStore);
  protected readonly sync = inject(SyncStatusStore);
  protected readonly clipboardCapture = inject(ClipboardCaptureStore);
  protected readonly ai = inject(AiStore);
  protected readonly stt = inject(SttStore);
  private readonly appearance = inject(AppearanceStore);
  /** Coordinator role for this instance (updated by the main process through `app:role-changed`). */
  protected readonly isPrimary = signal(false);
  protected readonly sshAliases = signal<readonly string[]>([]);

  constructor() {
    void this.store.createLocal();
    this.loadSshAliases();
    effect(() => this.clipboardCapture.syncActive(this.store.activeId()));
    effect(() => {
      const tab = this.search.tab();
      if (this.layout.panel() !== null && this.layout.panel() !== tab) this.layout.set(tab);
    });
    // Tab change: an ongoing recording is interrupted instead of ending up in the wrong draft.
    effect(() => {
      const activeId = this.store.activeId();
      untracked(() => {
        if (activeId !== undefined) {
          this.stt.halt();
        }
      });
    });
    // A new `lastSyncAt` (including one read from the primary through RPC) means a pull may have brought in new data.
    effect(() => {
      const lastSyncAt = this.sync.status().lastSyncAt;
      if (lastSyncAt !== undefined) {
        untracked(() => this.search.refresh());
      }
    });
    effect(() => {
      if (this.store.historyRecorded() > 0) {
        untracked(() => this.search.refresh());
      }
    });
    window.addEventListener('focus', () => {
      this.clipboardCapture.refresh();
      this.ai.load();
      void this.stt.load();
      this.sync.refresh();
      this.search.refresh();
    });
    this.sync.start();
    this.search.start();
    const api = window.smartTerminal;
    void api.onboardingState().then((state) => this.appearance.set(state.config.terminalFont ?? 'jetbrains')).catch(() => undefined);
    void api.runtimeInfo().then((info) => this.isPrimary.set(info.isPrimary));
    api.onRoleChanged((event) => this.isPrimary.set(event.isPrimary));
  }

  protected requestClose(id: string): void {
    const sessions = this.store.sessions();
    const target = sessions.find((session) => session.id === id);
    const needsConfirm =
      target !== undefined && id === this.store.activeId() && sessions.length > 1 && target.status === 'running';
    if (needsConfirm) {
      this.pendingCloseId.set(id);
      return;
    }
    this.store.close(id);
  }

  protected confirmClose(): void {
    const id = this.pendingCloseId();
    this.pendingCloseId.set(null);
    if (id !== null) {
      this.store.close(id);
    }
  }

  protected cancelClose(): void {
    this.pendingCloseId.set(null);
  }

  protected createLocal(): void {
    void this.store.createLocal();
  }

  protected createSsh(alias: string): void {
    void this.store.createSsh(alias);
  }

  protected retryCreate(): void {
    void this.store.retryCreate();
  }

  protected loadSshAliases(): void {
    window.smartTerminal.sshAliases().then(
      (aliases) => this.sshAliases.set(aliases),
      () => this.sshAliases.set([]),
    );
  }

  protected send(text: string): void {
    void this.store.sendActive(text);
  }

  /** Inserts text into the active session draft without sending it automatically. */
  protected insertText(text: string): void {
    const id = this.store.activeId();
    if (id !== null) {
      this.store.setDraft(id, text);
    }
  }

  protected setDraft(text: string): void {
    const id = this.store.activeId();
    if (id !== null) {
      this.store.setDraft(id, text);
    }
  }
}
