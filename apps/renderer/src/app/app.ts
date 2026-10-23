import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ClipboardCaptureStore } from './clipboard-capture/clipboard-capture-store';
import { AssistedInput } from './assisted-input/assisted-input';
import { AppHeader } from './header/app-header';
import { SessionTabs } from './session-tabs/session-tabs';
import type { SidebarTab } from './session.model';
import { SessionsStore } from './sessions-store';
import { SidebarPanel } from './sidebar-panel/sidebar-panel';
import { StatusFooter } from './status-footer/status-footer';
import { TerminalPanel } from './terminal-panel';
import { TerminalWorkarea } from './terminal-workarea/terminal-workarea';

@Component({
  selector: 'app-root',
  imports: [AppHeader, SessionTabs, TerminalWorkarea, TerminalPanel, AssistedInput, SidebarPanel, StatusFooter],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly store = inject(SessionsStore);
  /** Tab attivo in attesa di conferma di chiusura (dialogo inline, non bloccante). */
  protected readonly pendingCloseId = signal<string | null>(null);

  protected readonly sidebarTab = signal<SidebarTab>('clipboard');
  /** Ruolo coordinator di questa istanza (aggiornato dal main via `app:role-changed`). */
  protected readonly isPrimary = signal(false);

  private readonly clipboardCapture = inject(ClipboardCaptureStore);

  constructor() {
    void this.store.createLocal();
    effect(() => this.clipboardCapture.syncActive(this.store.activeId()));
    window.addEventListener('focus', () => this.clipboardCapture.refresh());
    const api = window.smartTerminal;
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

  protected send(text: string): void {
    void this.store.sendActive(text);
  }

  protected setDraft(text: string): void {
    const id = this.store.activeId();
    if (id !== null) {
      this.store.setDraft(id, text);
    }
  }
}
