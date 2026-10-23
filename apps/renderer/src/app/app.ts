import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('Smart Terminal');
  protected readonly ipcReady = signal(false);
  protected readonly appVersion = signal<string | null>(null);

  constructor() {
    void this.checkIpc();
  }

  private async checkIpc(): Promise<void> {
    try {
      const result = await window.smartTerminal.ping();
      this.appVersion.set(result.appVersion);
      this.ipcReady.set(true);
    } catch {
      this.ipcReady.set(false);
    }
  }
}
