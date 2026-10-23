import { Injectable, computed, signal } from '@angular/core';
import type { SmartTerminalApi, SyncStatusEvent } from '@smart-terminal/contracts';
import { syncBadge } from '../session.model';

export const SYNC_STATUS_POLL_MS = 5_000;

/** Sync state shown in the footer: events from the primary, polling every 5 seconds (secondaries read through RPC), and on focus. */
@Injectable({ providedIn: 'root' })
export class SyncStatusStore {
  private readonly api: SmartTerminalApi = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  private readonly statusState = signal<SyncStatusEvent>({ state: 'synced', remoteConfigured: true });
  private intervalTimer: ReturnType<typeof setInterval> | undefined;

  readonly status = this.statusState.asReadonly();
  readonly badge = computed(() => syncBadge(this.statusState().state, this.statusState().remoteConfigured));

  constructor() {
    this.api.onSyncStatus((status) => this.statusState.set(status));
  }

  start(): void {
    this.refresh();
    this.intervalTimer ??= setInterval(() => this.refresh(), SYNC_STATUS_POLL_MS);
  }

  stop(): void {
    clearInterval(this.intervalTimer);
    this.intervalTimer = undefined;
  }

  refresh(): void {
    void this.api
      .syncStatus()
      .then((status) => this.statusState.set(status))
      .catch(() => undefined); // An IPC error must not change the badge or affect terminals
  }
}
